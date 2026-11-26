'use strict';
// Воркер очереди. Антибан: у каждого номера своя пауза (nextAt) и флаг «занят»,
// дневной лимит с прогревом, окно отправки по TZ_NAME, автостоп при тревожных сигналах.
const { db, logEvent } = require('./db');
const { client } = require('./greenapi');
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
  if (!s) runtime.set(id, s = { nextAt: 0, pauseMs: 0, busy: false, errors: 0 });
  return s;
}
function resetInstance(id) {
  const s = rt(id);
  s.errors = 0;
  s.nextAt = 0;
  s.pauseMs = 0;
}
/** Перерыв после сообщения. От минуты и больше — целыми минутами: 2–4 мин → 2, 3 или 4 минуты */
function pickPauseMs(camp) {
  const lo = Math.max(MIN_DELAY_SEC, camp.delay_min);
  const hi = Math.max(lo, camp.delay_max);
  if (lo < 60) return randInt(lo * 1000, hi * 1000);
  const from = Math.ceil(lo / 60);
  return randInt(from, Math.max(from, Math.floor(hi / 60))) * 60000;
}
/** Когда номер отправит следующее сообщение и какой длины текущий перерыв (для обратного отсчёта) */
function nextSend(id) {
  const s = runtime.get(id);
  return s && s.nextAt > Date.now() ? { next_send_at: s.nextAt, pause_ms: s.pauseMs || 0 } : { next_send_at: null, pause_ms: 0 };
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
  }
  resetInstance(id);
}

const qClaim = db.prepare(`
  UPDATE messages SET status = 'sending', instance_id = ?
  WHERE id = (SELECT id FROM messages WHERE campaign_id = ? AND status = 'pending' ORDER BY id LIMIT 1)
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
    const text = renderTemplate(camp.text, { ...parseVars(contact.vars), name: contact.name, phone: contact.phone });
    const r = camp.media_url ?
    await api.sendFileByUrl(msg.phone, camp.media_url, camp.media_name || 'file', text) :
    await api.sendMessage(msg.phone, text);
    if (!r || !r.idMessage) throw new Error('GREEN-API не вернул idMessage');

    const now = Date.now();
    const today = dayInTz(now);
    await db.transaction(async () => {
      await qSent.run(String(r.idMessage), text, now, msg.id);
      await qInc.run(inst.id, today);
      await qFirstDay.run(today, inst.id);
    })();
    s.errors = 0;
    s.pauseMs = pickPauseMs(camp); // случайный перерыв после успешной отправки
    s.nextAt = now + s.pauseMs;
  } catch (e) {
    const status = e.status;
    const text = String(e.message || e).slice(0, 500);
    if (status === 466) {
      await qRequeue.run(text, msg.id);
      await stopInstance(inst.id, 'Исчерпан тариф GREEN-API (466)');
    } else if (status === 401 || status === 403) {
      await qRequeue.run(text, msg.id);
      await stopInstance(inst.id, `GREEN-API отклонил авторизацию (${status})`);
    } else if (status === 400) {
      await qFinal.run('failed', text, msg.id);
      s.errors++;
      s.pauseMs = Math.max(MIN_DELAY_SEC, camp.delay_min) * 1000;
      s.nextAt = Date.now() + s.pauseMs;
    } else {
      // сеть, 429, 5xx — сообщение обратно в очередь, номер отдыхает
      await qRequeue.run(text, msg.id);
      s.errors++;
      s.pauseMs = RETRY_DELAY_SEC * 1000;
      s.nextAt = Date.now() + s.pauseMs;
    }
    if (s.errors >= MAX_ERRORS) await stopInstance(inst.id, `${MAX_ERRORS} ошибок подряд. Последняя: ${text}`);
  }
}

async function tick() {
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
    if ((await sentToday(inst.id, today)) >= dailyLimit(inst, today)) continue;
    for (const camp of active) {
      let ids = [];
      try {ids = JSON.parse(camp.instance_ids) || [];} catch {/* пусто = все номера */}
      if (ids.length && !ids.includes(inst.id)) continue;
      if (!(hour >= camp.hour_from && hour < camp.hour_to)) continue;
      const msg = await qClaim.get(inst.id, camp.id);
      if (!msg) continue;
      s.busy = true;
      processMessage(inst, camp, msg).
      catch(async (e) => {
        await qRequeue.run(String(e.message || e).slice(0, 500), msg.id);
        await logEvent(`Сбой воркера: ${e.message}`, 'error', inst.id);
        s.nextAt = Date.now() + RETRY_DELAY_SEC * 1000;
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
  await Promise.all(insts.map((i) => refreshInstance(i).catch(() => {})));
}

let timers = [];
async function start() {
  // при старте сервера все «sending» возвращаем в очередь
  const r = await db.prepare("UPDATE messages SET status = 'pending' WHERE status = 'sending'").run();
  if (r.changes) await logEvent(`После перезапуска возвращено в очередь: ${r.changes}`, 'warn');
  timers.push(setInterval(() => tick().catch((e) => console.error('tick', e)), TICK_MS));
  timers.push(setInterval(() => pollStates().catch(() => {}), POLL_SEC * 1000));
  pollStates().catch(() => {});
}
function stop() {
  timers.forEach(clearInterval);
  timers = [];
}

module.exports = {
  start, stop, tick, stopInstance, resetInstance, refreshInstance, applyState, pollStates,
  dailyLimit, sentToday, nextSend, pickPauseMs, MIN_DELAY_SEC, BAD_STATES
};
