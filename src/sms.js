'use strict';
// SMS-рассылки через SMSC (smsc.kz): клиент API, очередь отправки и маршруты.
// Ключ API лежит только на сервере (SMSC_API_KEY) и в браузер не попадает.
const express = require('express');
const { db, logEvent } = require('./db');
const monitoring = require('./monitoring');
const { hourInTz, renderTemplate, normalizePhone, safeEqual } = require('./util');

const API_KEY = process.env.SMSC_API_KEY || '';
const BASE = String(process.env.SMSC_URL || 'https://smsc.kz').replace(/\/+$/, '');
const SENDER = String(process.env.SMSC_SENDER || '').trim();
const DELAY_MS = Math.max(0, Number(process.env.SMS_DELAY_MS ?? 1000)); // пауза между SMS
const RETRY_MS = Math.max(0, Number(process.env.SMS_RETRY_MS ?? 65000)); // SMSC не принимает одинаковый запрос чаще раза в минуту
const TICK_MS = Number(process.env.SMS_TICK_MS ?? 500);
const MAX_ERRORS = 5;

class SmscError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'SmscError';
    this.code = code; // код ошибки SMSC; undefined — сеть или непонятный ответ
  }
}
const bad = (message) => Object.assign(new Error(message), { status: 400 });

/** Понятные причины, по которым SMSC отклоняет отправку целиком (а не одно сообщение) */
const FATAL = {
  2: 'SMSC не принял ключ доступа. Проверьте SMSC_API_KEY в настройках сервера.',
  3: 'На счёте SMSC закончились деньги. Пополните баланс в кабинете SMSC и нажмите «Продолжить».',
  4: 'SMSC временно заблокировал адрес сервера из-за частых ошибок. Подождите и нажмите «Продолжить».',
  6: 'SMSC запретил отправку: для массовых и рекламных SMS нужен договор с SMSC. Заключите его в кабинете SMSC и нажмите «Продолжить».'
};

async function call(pathname, params) {
  if (!API_KEY) throw new SmscError('Не задан ключ SMSC (SMSC_API_KEY)');
  let r;
  try {
    r = await fetch(`${BASE}${pathname}`, {
      method: 'POST',
      body: new URLSearchParams({ apikey: API_KEY, fmt: '3', charset: 'utf-8', ...params }),
      signal: AbortSignal.timeout(30000)
    });
  } catch (e) {
    throw new SmscError(`SMSC недоступен (${e.cause?.code || e.name || e.message})`);
  }
  const data = await r.json().catch(() => null);
  if (!data || typeof data !== 'object') throw new SmscError(`SMSC вернул непонятный ответ (HTTP ${r.status})`);
  if (data.error) throw new SmscError(String(data.error), Number(data.error_code) || 0);
  return data;
}
/** Отправка одной SMS. Ответ: { id, cnt, cost, balance } */
function sendSms(phone, text) {
  return call('/sys/send.php', { phones: phone, mes: text, cost: '3', ...(SENDER ? { sender: SENDER } : {}) });
}

let balanceCache = { at: 0, value: null };
/** Баланс счёта SMSC; запрашиваем не чаще раза в минуту */
async function balance() {
  if (!API_KEY) return null;
  if (Date.now() - balanceCache.at < 60000) return balanceCache.value;
  balanceCache.at = Date.now();
  try {
    const n = Number((await call('/sys/balance.php', {})).balance);
    balanceCache.value = Number.isFinite(n) ? n : null;
  } catch {/* баланс — справочная цифра, её отсутствие не ошибка */}
  return balanceCache.value;
}

/** Сколько SMS займёт текст: кириллица 70 знаков в одной и по 67 в составной, латиница 160 и 153 */
function smsParts(text) {
  const s = String(text || '');
  if (!s) return 0;
  // eslint-disable-next-line no-control-regex
  const latin = /^[\x00-\x7F]*$/.test(s);
  const [single, multi] = latin ? [160, 153] : [70, 67];
  return s.length <= single ? 1 : Math.ceil(s.length / multi);
}

// ───────── Очередь ─────────
const qClaim = db.prepare(`
  UPDATE sms_messages SET status = 'sending'
  WHERE status = 'pending' AND id = (
    SELECT id FROM sms_messages WHERE campaign_id = ? AND status = 'pending' AND retry_at <= ? ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED)
  RETURNING *`);
const qFinish = db.prepare(`
  UPDATE sms_campaigns SET status = 'finished', finished_at = ?
  WHERE id = ? AND status = 'running'
    AND NOT EXISTS (SELECT 1 FROM sms_messages WHERE campaign_id = sms_campaigns.id AND status IN ('pending', 'sending'))`);

const errors = new Map(); // id рассылки → ошибок подряд
let nextAt = 0;
let ticking = false;

async function pause(camp, reason) {
  const r = await db.prepare("UPDATE sms_campaigns SET status = 'paused', pause_reason = ? WHERE id = ? AND status = 'running'").run(reason, camp.id);
  if (r.changes) {
    await logEvent(`SMS-рассылка «${camp.name}» остановлена: ${reason}`, 'error');
    monitoring.captureEvent(`SMS-рассылка остановлена: ${reason}`, 'warning', 'sms-pause', { campaignId: camp.id });
  }
  errors.delete(camp.id);
}

async function sendOne(camp, msg) {
  const contact = await db.prepare('SELECT * FROM contacts WHERE id = ?').get(msg.contact_id);
  if (!contact || contact.opted_out) {
    await db.prepare("UPDATE sms_messages SET status = 'skipped', error = ? WHERE id = ?").run(contact ? 'контакт в стоп-листе' : 'контакт удалён', msg.id);
    return;
  }
  let vars = {};
  try {vars = JSON.parse(contact.vars) || {};} catch {/* пусто */}
  const text = renderTemplate(camp.text, { ...vars, name: contact.name, phone: contact.phone });
  let r;
  try {
    r = await sendSms(msg.phone, text);
  } catch (e) {
    const note = String(e.message || e).slice(0, 500);
    if (!(e instanceof SmscError)) monitoring.captureError(e, 'sms-send', { campaignId: camp.id, messageId: msg.id });
    if (FATAL[e.code]) {
      // дело не в получателе: сообщение обратно в очередь, рассылка на паузу с понятной причиной
      await db.prepare("UPDATE sms_messages SET status = 'pending', error = ? WHERE id = ?").run(note, msg.id);
      await pause(camp, FATAL[e.code]);
    } else if (e.code === 7 || e.code === 8 || e.code === 1) {
      // неверный номер или сообщение нельзя доставить — к следующему получателю
      await db.prepare("UPDATE sms_messages SET status = 'failed', error = ? WHERE id = ?").run(note, msg.id);
    } else {
      // сеть, слишком частые запросы (9) и прочее — повторим позже
      await db.prepare("UPDATE sms_messages SET status = 'pending', error = ?, retry_at = ? WHERE id = ?").run(note, Date.now() + RETRY_MS, msg.id);
      const n = (errors.get(camp.id) || 0) + 1;
      errors.set(camp.id, n);
      if (n >= MAX_ERRORS) await pause(camp, `${MAX_ERRORS} ошибок подряд. Последняя: ${note}`);
    }
    return;
  }
  errors.delete(camp.id);
  if (r.balance !== undefined && Number.isFinite(Number(r.balance))) balanceCache = { at: Date.now(), value: Number(r.balance) };
  // SMS уже ушла: при сбое записи в очередь не возвращаем, иначе получатель получил бы её дважды
  try {
    await db.prepare("UPDATE sms_messages SET status = 'sent', sms_id = ?, text = ?, parts = ?, cost = ?, sent_at = ?, error = NULL WHERE id = ?").
    run(String(r.id ?? ''), text, Number(r.cnt) || smsParts(text), Number(r.cost) || 0, Date.now(), msg.id);
  } catch (e) {
    monitoring.captureError(e, 'sms-save', { campaignId: camp.id, messageId: msg.id });
    console.error('sms-save', e);
  }
}

async function tick() {
  if (ticking || !API_KEY || Date.now() < nextAt) return;
  ticking = true;
  try {
    const camps = await db.prepare("SELECT * FROM sms_campaigns WHERE status = 'running' ORDER BY id").all();
    const hour = hourInTz();
    for (const camp of camps) {
      if ((await qFinish.run(Date.now(), camp.id)).changes) {
        await logEvent(`SMS-рассылка «${camp.name}» завершена`);
        continue;
      }
      if (!(hour >= camp.hour_from && hour < camp.hour_to)) continue;
      const msg = await qClaim.get(camp.id, Date.now());
      if (!msg) continue;
      nextAt = Date.now() + DELAY_MS;
      await sendOne(camp, msg);
      break; // одна SMS за проход: ровный темп и предсказуемый расход
    }
  } finally {ticking = false;}
}

let timer = null;
async function start() {
  const r = await db.prepare("UPDATE sms_messages SET status = 'pending' WHERE status = 'sending'").run();
  if (r.changes) await logEvent(`SMS: после перезапуска возвращено в очередь: ${r.changes}`, 'warn');
  timer = setInterval(() => tick().catch((e) => {
    if (!timer) return;
    console.error('sms tick', e);
    monitoring.captureError(e, 'sms-tick');
  }), TICK_MS);
}
function stop() {
  clearInterval(timer);
  timer = null;
}

// ───────── Маршруты ─────────
async function stats(id) {
  const rows = await db.prepare('SELECT status, COUNT(*) n, COALESCE(SUM(parts), 0) p, COALESCE(SUM(cost), 0) c FROM sms_messages WHERE campaign_id = ? GROUP BY status').all(id);
  const by = {};
  let total = 0;
  let parts = 0;
  let cost = 0;
  for (const r of rows) {by[r.status] = Number(r.n);total += Number(r.n);parts += Number(r.p);cost += Number(r.c);}
  const g = (k) => by[k] || 0;
  return {
    total, sent: g('sent') + g('delivered'), delivered: g('delivered'), failed: g('failed'), skipped: g('skipped'),
    queue: g('pending') + g('sending'), parts, cost: Math.round(cost * 100) / 100
  };
}
const view = async (c) => ({ ...c, stats: await stats(c.id) });
const getCamp = async (id) => {
  const c = await db.prepare('SELECT * FROM sms_campaigns WHERE id = ?').get(Number(id));
  if (!c) throw Object.assign(new Error('SMS-рассылка не найдена'), { status: 404 });
  return c;
};
const clampHour = (v, def, min, max) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

function register(app, statusSecret) {
  app.get('/api/sms', async (req, res) => {
    const rows = await db.prepare('SELECT * FROM sms_campaigns ORDER BY id DESC').all();
    res.json({ ready: !!API_KEY, sender: SENDER || null, balance: await balance(), campaigns: await Promise.all(rows.map(view)) });
  });

  // Создать и сразу запустить: получатели — выбранная база без отписавшихся
  app.post('/api/sms', async (req, res) => {
    if (!API_KEY) throw bad('SMS не настроены: на сервере не задан ключ SMSC_API_KEY');
    const b = req.body || {};
    const name = String(b.name || '').trim().slice(0, 120);
    const text = String(b.text || '').slice(0, 1000);
    const listId = b.list_id === null || b.list_id === '' || b.list_id === undefined ? null : Number(b.list_id);
    const hourFrom = clampHour(b.hour_from, 10, 0, 23);
    const hourTo = clampHour(b.hour_to, 20, 1, 24);
    if (!name) throw bad('Укажите название рассылки');
    if (!text.trim()) throw bad('Введите текст SMS');
    if (hourTo <= hourFrom) throw bad('Час «до» должен быть больше часа «с»');
    if (listId !== null && !(await db.prepare('SELECT 1 FROM lists WHERE id = ?').get(listId))) throw bad('База не найдена');
    const id = await db.transaction(async () => {
      const cid = (await db.prepare(`INSERT INTO sms_campaigns(name, text, list_id, status, hour_from, hour_to, created_at, started_at)
        VALUES (?, ?, ?, 'running', ?, ?, ?, ?) RETURNING id`).get(name, text, listId, hourFrom, hourTo, Date.now(), Date.now())).id;
      const conds = ['c.opted_out = 0'];
      const args = [cid];
      if (listId !== null) {conds.push('c.id IN (SELECT contact_id FROM list_contacts WHERE list_id = ?)');args.push(listId);}
      const r = await db.prepare(`INSERT INTO sms_messages(campaign_id, contact_id, phone, status)
        SELECT ?, c.id, c.phone, 'pending' FROM contacts c WHERE ${conds.join(' AND ')} ORDER BY c.id`).run(...args);
      if (!r.changes) throw bad('Нет получателей: база пуста или все в стоп-листе');
      return cid;
    })();
    const c = await view(await getCamp(id));
    await logEvent(`SMS-рассылка «${name}» запущена, получателей: ${c.stats.total}`);
    res.json(c);
  });

  const transition = (action, from, to, label) => app.post(`/api/sms/:id/${action}`, async (req, res) => {
    const c = await getCamp(req.params.id);
    if (!from.includes(c.status)) throw bad('Действие сейчас недоступно');
    await db.prepare('UPDATE sms_campaigns SET status = ?, pause_reason = NULL WHERE id = ?').run(to, c.id);
    errors.delete(c.id);
    await logEvent(`SMS-рассылка «${c.name}»: ${label}`);
    res.json(await view(await getCamp(c.id)));
  });
  transition('pause', ['running'], 'paused', 'пауза');
  transition('resume', ['paused'], 'running', 'продолжена');
  transition('stop', ['running', 'paused'], 'stopped', 'остановлена');

  app.delete('/api/sms/:id', async (req, res) => {
    const c = await getCamp(req.params.id);
    if (c.status === 'running') throw bad('Сначала остановите рассылку');
    await db.transaction(async () => {
      await db.prepare('DELETE FROM sms_messages WHERE campaign_id = ?').run(c.id);
      await db.prepare('DELETE FROM sms_campaigns WHERE id = ?').run(c.id);
    })();
    await logEvent(`SMS-рассылка «${c.name}» удалена`, 'warn');
    res.json({ ok: true });
  });

  // Одна SMS на указанный номер — проверить, как выглядит и доходит ли
  app.post('/api/sms/test', async (req, res) => {
    const phone = normalizePhone(req.body?.phone);
    const text = String(req.body?.text || '').slice(0, 1000).trim();
    if (!phone) throw bad('Введите номер телефона с кодом страны');
    if (!text) throw bad('Введите текст SMS');
    try {
      const r = await sendSms(phone, text);
      await logEvent(`Пробная SMS на ${phone} отправлена`);
      res.json({ ok: true, parts: Number(r.cnt) || smsParts(text), cost: Number(r.cost) || 0, balance: r.balance !== undefined ? Number(r.balance) : null });
    } catch (e) {
      throw bad(FATAL[e.code] || `SMSC: ${e.message}`);
    }
  });

  // Статусы доставки от SMSC («URL для ответов и статусов» в кабинете). Всегда 200.
  app.all('/sms-status/:secret', express.urlencoded({ extended: false }), async (req, res) => {
    res.status(200).send('OK');
    if (!statusSecret || !safeEqual(req.params.secret, statusSecret)) return;
    try {
      const p = { ...req.query, ...(req.body || {}) };
      const id = String(p.id || '');
      const phone = String(p.phone || '').replace(/\D/g, '');
      const status = Number(p.status);
      if (!id || !phone || !Number.isFinite(status)) return;
      // 1 — доставлено, 2 — прочитано; 3 и 20–25 — не доставлено (просрочено, неверный номер, запрещено и т.п.)
      const to = status === 1 || status === 2 ? 'delivered' : status === 3 || status >= 20 ? 'failed' : null;
      if (!to) return;
      await db.prepare(`UPDATE sms_messages SET status = ?, error = ? WHERE sms_id = ? AND phone = ? AND status IN ('sent', 'delivered')`).
      run(to, to === 'failed' ? `не доставлено (статус ${status})` : null, id, phone);
    } catch (e) {
      monitoring.captureError(e, 'sms-status');
    }
  });
}

module.exports = { register, start, stop, tick, smsParts, ready: !!API_KEY };
