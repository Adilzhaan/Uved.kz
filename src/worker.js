'use strict';
// Воркер очереди. Антибан: у каждого номера своя пауза (nextAt) и флаг «занят»,
// дневной лимит с прогревом, окно отправки по TZ_NAME, автостоп при тревожных сигналах.
const { db, logEvent } = require('./db');
const { client, GreenApiError } = require('./greenapi');
const monitoring = require('./monitoring');
const { dayInTz, hourInTz, daysBetween, renderTemplate, randInt } = require('./util');

const MIN_DELAY_SEC = Math.max(0, Number(process.env.MIN_DELAY_SEC ?? 5));
const RETRY_DELAY_SEC = Number(process.env.RETRY_DELAY_SEC ?? 60);
const TICK_MS = Number(process.env.TICK_MS ?? 1000);
const POLL_SEC = Number(process.env.POLL_SEC ?? 60);
const MAX_ERRORS = 5;
const BAD_STATES = new Set(['blocked', 'yellowCard']);

const runtime = new Map(); // instance.id → { nextAt, busy, errors }
function rt(id) {
  let s = runtime.get(id);
  if (!s) runtime.set(id, s = { nextAt: 0, pauseMs: 0, busy: false, errors: 0, streak: 0, restAfter: 0, longRest: false, primed: false });
  return s;
}
function resetInstance(id) {
  const s = rt(id);
  s.errors = 0;
  s.nextAt = 0;
  s.pauseMs = 0;
  s.longRest = false;
  s.primed = false; // перерыв заново отсчитаем от последней реальной отправки номера
}
const qLastSent = db.prepare('SELECT MAX(sent_at) AS at FROM messages WHERE instance_id = ?');
/**
 * Память о перерывах живёт в процессе. После перезапуска сервера или включения номера
 * отсчитываем перерыв от последнего реально отправленного сообщения, иначе номер
 * отправил бы следующее сразу — два сообщения подряд без паузы.
 */
async function prime(inst, s, camp) {
  const last = (await qLastSent.get(inst.id))?.at;
  s.primed = true;
  if (!last) return;
  const pause = pickPauseMs(camp);
  if (last + pause > Date.now()) {
    s.pauseMs = pause;
    s.nextAt = last + pause;
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Запись в базу с повторами: короткий обрыв связи с БД не должен ломать очередь */
async function persist(fn, tries = 5) {
  for (let i = 1; ; i++) {
    try {return await fn();} catch (e) {
      if (i >= tries) throw e;
      await sleep(500 * i);
    }
  }
}
/** Перерыв после сообщения. От минуты и больше — целыми минутами: 2–4 мин → 2, 3 или 4 минуты */
function pickPauseMs(camp) {
  const lo = Math.max(MIN_DELAY_SEC, camp.delay_min);
  const hi = Math.max(lo, camp.delay_max);
  if (lo < 60) return randInt(lo * 1000, hi * 1000);
  const from = Math.ceil(lo / 60);
  // ровные интервалы выглядят как робот, поэтому к целым минутам добавляем случайные секунды
  return randInt(from, Math.max(from, Math.floor(hi / 60))) * 60000 + randInt(-25000, 25000);
}
/**
 * Перерыв после успешной отправки. Раз в 15–25 сообщений подряд номер отдыхает 12–20 минут,
 * как живой человек. В тестовом режиме (перерыв меньше минуты) длинного отдыха нет.
 */
function nextPause(s, camp) {
  s.longRest = false;
  if (Math.max(MIN_DELAY_SEC, camp.delay_min) < 60) return pickPauseMs(camp);
  if (!s.restAfter) s.restAfter = randInt(15, 25);
  s.streak += 1;
  if (s.streak < s.restAfter) return pickPauseMs(camp);
  s.streak = 0;
  s.restAfter = randInt(15, 25);
  s.longRest = true;
  return randInt(12 * 60000, 20 * 60000);
}
/** Когда номер отправит следующее сообщение и какой длины текущий перерыв (для обратного отсчёта) */
function nextSend(id) {
  const s = runtime.get(id);
  return s && s.nextAt > Date.now() ?
  { next_send_at: s.nextAt, pause_ms: s.pauseMs || 0, long_rest: !!s.longRest } :
  { next_send_at: null, pause_ms: 0, long_rest: false };
}

/** Дневной лимит с прогревом: min(max, start + step × дней с первой отправки) */
function dailyLimit(inst, today = dayInTz()) {
  const days = inst.first_send_day ? Math.max(0, daysBetween(inst.first_send_day, today)) : 0;
  return Math.min(inst.daily_limit_max, inst.daily_limit_start + inst.warmup_step * days);
}
const qCount = db.prepare('SELECT count FROM daily_counts WHERE instance_id = ? AND day = ?');
async function sentToday(instanceId, today = dayInTz()) {
  return (await qCount.get(instanceId, today))?.count || 0;
}

/** Автостоп номера: enabled=0 + причина + запись в журнал */
async function stopInstance(id, reason) {
  const r = await db.prepare('UPDATE instances SET enabled = 0, disabled_reason = ? WHERE id = ? AND enabled = 1').run(reason, id);
  if (r.changes) {
    const inst = await db.prepare('SELECT name FROM instances WHERE id = ?').get(id);
    await logEvent(`Номер «${inst?.name || id}» остановлен: ${reason}`, 'error', id);
    // номер выбыл — рассылка замедлилась или встала, об этом нужно узнать сразу
    monitoring.captureEvent(`Номер «${inst?.name || id}» остановлен автостопом`, 'warning', 'instance-stop', { instanceId: id, reason });
  }
  resetInstance(id);
}

// FOR UPDATE SKIP LOCKED и повторная проверка статуса: одно сообщение не достанется двум номерам
const qClaim = db.prepare(`
  UPDATE messages SET status = 'sending', instance_id = ?
  WHERE status = 'pending' AND id = (
    SELECT id FROM messages WHERE campaign_id = ? AND status = 'pending' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED)
  RETURNING *`);
const qRequeue = db.prepare("UPDATE messages SET status = 'pending', error = ? WHERE id = ? AND status = 'sending'");
const qFinal = db.prepare("UPDATE messages SET status = ?, error = ? WHERE id = ? AND status = 'sending'");
const qSent = db.prepare("UPDATE messages SET status = 'sent', id_message = ?, text = ?, sent_at = ?, error = NULL WHERE id = ? AND status = 'sending'");
const qInc = db.prepare(`INSERT INTO daily_counts(instance_id, day, count) VALUES (?, ?, 1)
  ON CONFLICT(instance_id, day) DO UPDATE SET count = daily_counts.count + 1`);
const qFirstDay = db.prepare('UPDATE instances SET first_send_day = ? WHERE id = ? AND first_send_day IS NULL');
const qContact = db.prepare('SELECT * FROM contacts WHERE id = ?');
const qFinish = db.prepare(`
  UPDATE campaigns SET status = 'finished', finished_at = ?
  WHERE id = ? AND status = 'running'
    AND NOT EXISTS (SELECT 1 FROM messages WHERE campaign_id = campaigns.id AND status IN ('pending', 'sending'))`);

async function finishIfDone(campaign) {
  if ((await qFinish.run(Date.now(), campaign.id)).changes) {
    await logEvent(`Кампания «${campaign.name}» завершена`);
    return true;
  }
  return false;
}

/** Текст для сообщения: если у рассылки несколько вариантов, берём случайный */
function pickText(camp) {
  let extra = [];
  try {extra = JSON.parse(camp.extra_texts || '[]') || [];} catch {/* пусто */}
  const all = [camp.text, ...extra].filter((t) => typeof t === 'string' && t.trim());
  return all.length ? all[randInt(0, all.length - 1)] : camp.text || '';
}
/** Перерыв рассылки изменили на ходу: номера, которые ждут дольше нового максимума, пересчитываем */
function applyPace(instanceIds, camp) {
  const now = Date.now();
  const hi = Math.max(MIN_DELAY_SEC, camp.delay_min, camp.delay_max) * 1000;
  for (const id of instanceIds) {
    const s = runtime.get(id);
    if (!s || s.longRest || s.nextAt <= now || s.nextAt - now <= hi + 25000) continue;
    s.pauseMs = pickPauseMs(camp);
    s.nextAt = now + s.pauseMs;
  }
}
function parseVars(json) {
  try {return JSON.parse(json) || {};} catch {return {};}
}

async function processMessage(inst, camp, msg) {
  const s = rt(inst.id);
  const contact = await qContact.get(msg.contact_id);
  if (!contact || contact.opted_out) {
    await qFinal.run('skipped', contact ? 'контакт в стоп-листе' : 'контакт удалён', msg.id);
    return;
  }
  const api = client(inst);
  try {
    if (camp.check_wa) {
      const r = await api.checkWhatsapp(msg.phone);
      if (r && r.existsWhatsapp === false) {
        await qFinal.run('no_wa', null, msg.id);
        s.errors = 0;
        s.nextAt = Date.now() + Math.min(3, MIN_DELAY_SEC) * 1000;
        return;
      }
    }
    const text = renderTemplate(pickText(camp), { ...parseVars(contact.vars), name: contact.name, phone: contact.phone });
    const r = camp.media_url ?
    await api.sendFileByUrl(msg.phone, camp.media_url, camp.media_name || 'file', text) :
    await api.sendMessage(msg.phone, text);
    if (!r || !r.idMessage) throw new Error('GREEN-API не вернул idMessage');

    // сообщение ушло: перерыв назначаем сразу, что бы ни случилось с записью в базу
    const now = Date.now();
    const today = dayInTz(now);
    s.errors = 0;
    s.pauseMs = nextPause(s, camp); // случайный перерыв после успешной отправки
    s.nextAt = now + s.pauseMs;
    try {
      await persist(db.transaction(async () => {
        await qSent.run(String(r.idMessage), text, now, msg.id);
        await qInc.run(inst.id, today);
        await qFirstDay.run(today, inst.id);
      }));
    } catch (e) {
      // в очередь не возвращаем: сообщение уже доставлено в GREEN-API, повтор был бы дублем получателю
      monitoring.captureError(e, 'worker-save', { instanceId: inst.id, campaignId: camp.id, messageId: msg.id });
      console.error('worker-save', e);
    }
  } catch (e) {
    const status = e.status;
    const text = String(e.message || e).slice(0, 500);
    // ошибки GREEN-API — штатная работа очереди; всё остальное (БД, баг в коде) — в Sentry
    if (!(e instanceof GreenApiError)) monitoring.captureError(e, 'worker-send', { instanceId: inst.id, campaignId: camp.id, messageId: msg.id });
    // сначала перерыв в памяти, потом запись в базу: даже если база недоступна, номер не начнёт частить
    s.errors++;
    s.longRest = false;
    // 400 — получателю отказано, идём к следующему с обычным перерывом; остальное — короткий отдых и повтор
    s.pauseMs = status === 400 ? pickPauseMs(camp) : RETRY_DELAY_SEC * 1000;
    s.nextAt = Date.now() + s.pauseMs;
    if (status === 466) {
      await persist(() => qRequeue.run(text, msg.id));
      await stopInstance(inst.id, 'Исчерпан тариф GREEN-API (466)');
    } else if (status === 401 || status === 403) {
      await persist(() => qRequeue.run(text, msg.id));
      await stopInstance(inst.id, `GREEN-API отклонил авторизацию (${status})`);
    } else if (status === 400) {
      await persist(() => qFinal.run('failed', text, msg.id));
    } else {
      // сеть, 429, 5xx — сообщение обратно в очередь, номер отдыхает
      await persist(() => qRequeue.run(text, msg.id));
    }
    if (s.errors >= MAX_ERRORS) await stopInstance(inst.id, `${MAX_ERRORS} ошибок подряд. Последняя: ${text}`);
  }
}

// Тики не накладываются: если предыдущий ещё ждёт ответа базы, новый пропускаем.
// Иначе два тика могли бы одновременно выдать одному номеру два сообщения подряд без перерыва.
let ticking = false;
async function tick() {
  if (ticking) return;
  ticking = true;
  try {await tickOnce();} finally {ticking = false;}
}
async function tickOnce() {
  const camps = await db.prepare("SELECT * FROM campaigns WHERE status = 'running' ORDER BY id").all();
  if (!camps.length) return;
  const done = await Promise.all(camps.map(finishIfDone));
  const active = camps.filter((_, i) => !done[i]);
  if (!active.length) return;
  const insts = await db.prepare("SELECT * FROM instances WHERE enabled = 1 AND state = 'authorized'").all();
  const now = Date.now();
  const today = dayInTz(now);
  const hour = hourInTz(now);

  for (const inst of insts) {
    const s = rt(inst.id);
    if (s.busy || now < s.nextAt) continue;
    const mine = active.filter((camp) => {
      let ids = [];
      try {ids = JSON.parse(camp.instance_ids) || [];} catch {/* пусто = все номера */}
      return (!ids.length || ids.includes(inst.id)) && hour >= camp.hour_from && hour < camp.hour_to;
    });
    if (!mine.length) continue;
    if (!s.primed) {
      await prime(inst, s, mine[0]);
      if (Date.now() < s.nextAt) continue;
    }
    if ((await sentToday(inst.id, today)) >= dailyLimit(inst, today)) continue;
    for (const camp of mine) {
      const msg = await qClaim.get(inst.id, camp.id);
      if (!msg) continue;
      s.busy = true;
      processMessage(inst, camp, msg).
      catch(async (e) => {
        // сюда попадаем, когда не удалась запись в базу; обработчик сам падать не должен
        s.nextAt = Math.max(s.nextAt, Date.now() + RETRY_DELAY_SEC * 1000);
        monitoring.captureError(e, 'worker', { instanceId: inst.id, campaignId: camp.id, messageId: msg.id });
        console.error('worker', e);
        await logEvent(`Сбой воркера: ${e.message}`, 'error', inst.id).catch(() => {});
      }).
      finally(() => {s.busy = false;});
      break;
    }
  }
}

/** Опрос состояния одного номера; при authorized подтягивает phone */
async function refreshInstance(inst) {
  const api = client(inst);
  const r = await api.getStateInstance();
  const state = r && r.stateInstance || 'unknown';
  let phone = inst.phone;
  if (state === 'authorized' && !phone) {
    try {
      const w = await api.getWaSettings();
      phone = String(w && (w.phone || w.wid) || '').replace(/\D/g, '') || null;
    } catch {/* не критично */}
  }
  if (state !== 'authorized') phone = state === 'notAuthorized' ? null : phone;
  await applyState(inst.id, state, phone);
  return state;
}

async function applyState(id, state, phone) {
  const prev = await db.prepare('SELECT state, name, phone FROM instances WHERE id = ?').get(id);
  if (!prev) return;
  await db.prepare('UPDATE instances SET state = ?, phone = ? WHERE id = ?').run(state, phone === undefined ? prev.phone : phone, id);
  if (prev.state !== state) await logEvent(`Номер «${prev.name}»: состояние ${prev.state} → ${state}`, BAD_STATES.has(state) ? 'error' : 'info', id);
  if (BAD_STATES.has(state)) await stopInstance(id, `Состояние номера: ${state}`);
}

async function pollStates() {
  const insts = await db.prepare('SELECT * FROM instances').all();
  await Promise.all(insts.map((i) => refreshInstance(i).catch(async (e) => {
    // недоступность GREEN-API здесь обычна (опрос раз в минуту), а остальное — сбой
    if (!(e instanceof GreenApiError)) return monitoring.captureError(e, 'poll-states', { instanceId: i.id });
    // подключение не оплачено или данные доступа отозваны — показываем это человеку как состояние номера
    const state = e.status === 466 || /expired/i.test(e.message) ? 'expired' : e.status === 401 || e.status === 403 ? 'badToken' : null;
    if (state) await applyState(i.id, state).catch(() => {});
  })));
}

let timers = [];
async function start() {
  // при старте сервера все «sending» возвращаем в очередь
  const r = await db.prepare("UPDATE messages SET status = 'pending' WHERE status = 'sending'").run();
  if (r.changes) await logEvent(`После перезапуска возвращено в очередь: ${r.changes}`, 'warn');
  // после stop() пул базы уже закрыт: ошибку тика, начатого до остановки, не считаем сбоем
  timers.push(setInterval(() => tick().catch((e) => {if (!timers.length) return;console.error('tick', e);monitoring.captureError(e, 'worker-tick');}), TICK_MS));
  const poll = () => pollStates().catch((e) => monitoring.captureError(e, 'poll-states'));
  timers.push(setInterval(poll, POLL_SEC * 1000));
  poll();
}
function stop() {
  timers.forEach(clearInterval);
  timers = [];
}

module.exports = {
  start, stop, tick, stopInstance, resetInstance, refreshInstance, applyState, pollStates,
  dailyLimit, sentToday, nextSend, pickPauseMs, pickText, applyPace, MIN_DELAY_SEC, BAD_STATES
};
