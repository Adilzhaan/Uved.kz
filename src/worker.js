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
  if (!s) runtime.set(id, (s = { nextAt: 0, busy: false, errors: 0 }));
  return s;
}
function resetInstance(id) {
  const s = rt(id);
  s.errors = 0;
  s.nextAt = 0;
}

/** Дневной лимит с прогревом: min(max, start + step × дней с первой отправки) */
function dailyLimit(inst, today = dayInTz()) {
  const days = inst.first_send_day ? Math.max(0, daysBetween(inst.first_send_day, today)) : 0;
  return Math.min(inst.daily_limit_max, inst.daily_limit_start + inst.warmup_step * days);
}
const qCount = db.prepare('SELECT count FROM daily_counts WHERE instance_id = ? AND day = ?');
function sentToday(instanceId, today = dayInTz()) {
  return qCount.get(instanceId, today)?.count || 0;
}

/** Автостоп номера: enabled=0 + причина + запись в журнал */
function stopInstance(id, reason) {
  const r = db.prepare('UPDATE instances SET enabled = 0, disabled_reason = ? WHERE id = ? AND enabled = 1').run(reason, id);
  if (r.changes) {
    const inst = db.prepare('SELECT name FROM instances WHERE id = ?').get(id);
    logEvent(`Номер «${inst?.name || id}» остановлен: ${reason}`, 'error', id);
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
  ON CONFLICT(instance_id, day) DO UPDATE SET count = count + 1`);
const qFirstDay = db.prepare('UPDATE instances SET first_send_day = ? WHERE id = ? AND first_send_day IS NULL');
const qContact = db.prepare('SELECT * FROM contacts WHERE id = ?');
const qFinish = db.prepare(`
  UPDATE campaigns SET status = 'finished', finished_at = ?
  WHERE id = ? AND status = 'running'
    AND NOT EXISTS (SELECT 1 FROM messages WHERE campaign_id = campaigns.id AND status IN ('pending', 'sending'))`);

function finishIfDone(campaign) {
  if (qFinish.run(Date.now(), campaign.id).changes) {
    logEvent(`Кампания «${campaign.name}» завершена`);
    return true;
  }
  return false;
}

function parseVars(json) {
  try { return JSON.parse(json) || {}; } catch { return {}; }
}

async function processMessage(inst, camp, msg) {
  const s = rt(inst.id);
  const contact = qContact.get(msg.contact_id);
  if (!contact || contact.opted_out) {
    qFinal.run('skipped', contact ? 'контакт в стоп-листе' : 'контакт удалён', msg.id);
    return;
  }
  const api = client(inst);
  try {
    if (camp.check_wa) {
      const r = await api.checkWhatsapp(msg.phone);
      if (r && r.existsWhatsapp === false) {
        qFinal.run('no_wa', null, msg.id);
        s.errors = 0;
        s.nextAt = Date.now() + Math.min(3, MIN_DELAY_SEC) * 1000;
        return;
      }
    }
    const text = renderTemplate(camp.text, { ...parseVars(contact.vars), name: contact.name, phone: contact.phone });
    const r = camp.media_url
      ? await api.sendFileByUrl(msg.phone, camp.media_url, camp.media_name || 'file', text)
      : await api.sendMessage(msg.phone, text);
    if (!r || !r.idMessage) throw new Error('GREEN-API не вернул idMessage');

    const now = Date.now();
    const today = dayInTz(now);
    db.transaction(() => {
      qSent.run(String(r.idMessage), text, now, msg.id);
      qInc.run(inst.id, today);
      qFirstDay.run(today, inst.id);
    })();
    s.errors = 0;
    const lo = Math.max(MIN_DELAY_SEC, camp.delay_min);
    const hi = Math.max(lo, camp.delay_max);
    s.nextAt = now + randInt(lo * 1000, hi * 1000); // случайная пауза после успешной отправки
  } catch (e) {
    const status = e.status;
    const text = String(e.message || e).slice(0, 500);
    if (status === 466) {
      qRequeue.run(text, msg.id);
      stopInstance(inst.id, 'Исчерпан тариф GREEN-API (466)');
    } else if (status === 401 || status === 403) {
      qRequeue.run(text, msg.id);
      stopInstance(inst.id, `GREEN-API отклонил авторизацию (${status})`);
    } else if (status === 400) {
      qFinal.run('failed', text, msg.id);
      s.errors++;
      s.nextAt = Date.now() + Math.max(MIN_DELAY_SEC, camp.delay_min) * 1000;
    } else {
      // сеть, 429, 5xx — сообщение обратно в очередь, номер отдыхает
      qRequeue.run(text, msg.id);
      s.errors++;
      s.nextAt = Date.now() + RETRY_DELAY_SEC * 1000;
    }
    if (s.errors >= MAX_ERRORS) stopInstance(inst.id, `${MAX_ERRORS} ошибок подряд. Последняя: ${text}`);
  }
}

function tick() {
  const camps = db.prepare("SELECT * FROM campaigns WHERE status = 'running' ORDER BY id").all();
  if (!camps.length) return;
  const active = camps.filter((c) => !finishIfDone(c));
  if (!active.length) return;
  const insts = db.prepare("SELECT * FROM instances WHERE enabled = 1 AND state = 'authorized'").all();
  const now = Date.now();
  const today = dayInTz(now);
  const hour = hourInTz(now);

  for (const inst of insts) {
    const s = rt(inst.id);
    if (s.busy || now < s.nextAt) continue;
    if (sentToday(inst.id, today) >= dailyLimit(inst, today)) continue;
    for (const camp of active) {
      let ids = [];
      try { ids = JSON.parse(camp.instance_ids) || []; } catch { /* пусто = все номера */ }
      if (ids.length && !ids.includes(inst.id)) continue;
      if (!(hour >= camp.hour_from && hour < camp.hour_to)) continue;
      const msg = qClaim.get(inst.id, camp.id);
      if (!msg) continue;
      s.busy = true;
      processMessage(inst, camp, msg)
        .catch((e) => {
          qRequeue.run(String(e.message || e).slice(0, 500), msg.id);
          logEvent(`Сбой воркера: ${e.message}`, 'error', inst.id);
          s.nextAt = Date.now() + RETRY_DELAY_SEC * 1000;
        })
        .finally(() => { s.busy = false; });
      break;
    }
  }
}

/** Опрос состояния одного номера; при authorized подтягивает phone */
async function refreshInstance(inst) {
  const api = client(inst);
  const r = await api.getStateInstance();
  const state = (r && r.stateInstance) || 'unknown';
  let phone = inst.phone;
  if (state === 'authorized' && !phone) {
    try {
      const w = await api.getWaSettings();
      phone = String((w && (w.phone || w.wid)) || '').replace(/\D/g, '') || null;
    } catch { /* не критично */ }
  }
  if (state !== 'authorized') phone = state === 'notAuthorized' ? null : phone;
  applyState(inst.id, state, phone);
  return state;
}

function applyState(id, state, phone) {
  const prev = db.prepare('SELECT state, name, phone FROM instances WHERE id = ?').get(id);
  if (!prev) return;
  db.prepare('UPDATE instances SET state = ?, phone = ? WHERE id = ?').run(state, phone === undefined ? prev.phone : phone, id);
  if (prev.state !== state) logEvent(`Номер «${prev.name}»: состояние ${prev.state} → ${state}`, BAD_STATES.has(state) ? 'error' : 'info', id);
  if (BAD_STATES.has(state)) stopInstance(id, `Состояние номера: ${state}`);
}

async function pollStates() {
  const insts = db.prepare('SELECT * FROM instances').all();
  await Promise.all(insts.map((i) => refreshInstance(i).catch(() => {})));
}

let timers = [];
function start() {
  // при старте сервера все «sending» возвращаем в очередь
  const r = db.prepare("UPDATE messages SET status = 'pending' WHERE status = 'sending'").run();
  if (r.changes) logEvent(`После перезапуска возвращено в очередь: ${r.changes}`, 'warn');
  timers.push(setInterval(() => {
    try { tick(); } catch (e) { console.error('tick', e); }
  }, TICK_MS));
  timers.push(setInterval(() => pollStates().catch(() => {}), POLL_SEC * 1000));
  pollStates().catch(() => {});
}
function stop() {
  timers.forEach(clearInterval);
  timers = [];
}

module.exports = {
  start, stop, tick, stopInstance, resetInstance, refreshInstance, applyState, pollStates,
  dailyLimit, sentToday, MIN_DELAY_SEC, BAD_STATES,
};
