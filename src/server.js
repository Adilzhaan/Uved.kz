'use strict';
// мониторинг первым: Sentry должен обернуть express и pg до их загрузки
const monitoring = require('./monitoring');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');

const { db, initDb, MEDIA_DIR, logEvent, getSetting, setSetting } = require('./db');
const { client } = require('./greenapi');
const { importFile, parseStandardFile } = require('./importer');
const worker = require('./worker');
const { handleWebhook, optOut } = require('./webhooks');
const {
  TZ, dayInTz, daysBetween, normalizePhone, renderTemplate, makeToken, checkToken, safeEqual, csvCell
} = require('./util');

const PORT = Number(process.env.PORT || 3000);
const ADMIN_LOGIN = String(process.env.ADMIN_LOGIN || 'admin').trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const PUBLIC_URL = String(process.env.PUBLIC_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '')).replace(/\/+$/, '');
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_TTL = 30 * 24 * 3600 * 1000;
const DEFAULT_API_URL = 'https://api.green-api.com';
// Партнёрский API GREEN-API: сервис сам создаёт подключения, клиенту остаётся только QR-код
const PARTNER_TOKEN = process.env.GREEN_PARTNER_TOKEN || '';
const PARTNER_URL = String(process.env.GREEN_PARTNER_URL || DEFAULT_API_URL).replace(/\/+$/, '');
const MAX_NUMBERS = Math.max(1, Number(process.env.MAX_NUMBERS || 10));
async function partnerCall(method, payload) {
  let r;
  try {
    r = await fetch(`${PARTNER_URL}/partner/${method}/${PARTNER_TOKEN}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000)
    });
  } catch {
    throw new HttpError(502, 'Не удалось связаться с GREEN-API. Попробуйте ещё раз через минуту.');
  }
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new HttpError(502, `GREEN-API отклонил запрос (${r.status}). Попробуйте ещё раз позже.`);
  return body;
}

if (!ADMIN_PASSWORD) {
  console.error('Не задан ADMIN_PASSWORD — укажите его в .env');
  process.exit(1);
}
if (!process.env.SESSION_SECRET) console.warn('SESSION_SECRET не задан: сессии сбросятся при перезапуске');
if (!PUBLIC_URL) console.warn('PUBLIC_URL не задан: вебхуки GREEN-API и ссылки на медиа работать не будут');
if (PUBLIC_URL && !WEBHOOK_SECRET) console.warn('WEBHOOK_SECRET не задан: вебхуки приниматься не будут');

class HttpError extends Error {
  constructor(status, message) {super(message);this.status = status;}
}
const bad = (message) => new HttpError(400, message);
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const int = (v, def, min, max) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
};

const app = express();
// Express 4 не перехватывает отклонённые Promise в async обработчиках.
for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
  const register = app[method].bind(app);
  app[method] = (route, ...handlers) => register(route, ...handlers.map((fn) =>
    fn.constructor.name === 'AsyncFunction' ? wrap(fn) : fn));
}
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.get('/health', async (req, res) => {
  try {
    await db.prepare('SELECT 1').get();
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

// ───────── Вебхук GREEN-API: без авторизации, всегда 200 ─────────
app.post('/webhook/:secret', async (req, res) => {
  if (!WEBHOOK_SECRET || !safeEqual(req.params.secret, WEBHOOK_SECRET)) return res.status(200).json({ ok: true });
  try {
    await handleWebhook(req.body);
  } catch (e) {
    console.error('webhook', e);
    monitoring.captureError(e, 'webhook', { typeWebhook: req.body?.typeWebhook, idInstance: req.body?.instanceData?.idInstance });
  }
  res.status(200).json({ ok: true });
});

// ───────── Публичная раздача медиа ─────────
app.use('/media', express.static(MEDIA_DIR, {
  index: false,
  maxAge: '7d',
  setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff')
}));

// ───────── Авторизация ─────────
const attempts = new Map(); // ip → { n, until }
app.post('/api/login', (req, res) => {
  const ip = req.ip || 'x';
  const a = attempts.get(ip);
  if (a && a.n >= 10 && a.until > Date.now()) return res.status(429).json({ error: 'Слишком много попыток. Подождите 15 минут.' });
  // логин без учёта регистра; обе проверки выполняются всегда, чтобы не подсказывать, что именно неверно
  const loginOk = safeEqual(String(req.body?.login ?? '').trim().toLowerCase(), ADMIN_LOGIN.toLowerCase());
  const passwordOk = safeEqual(String(req.body?.password ?? ''), ADMIN_PASSWORD);
  if (!loginOk || !passwordOk) {
    const cur = a && a.until > Date.now() ? a : { n: 0, until: Date.now() + 15 * 60000 };
    cur.n++;
    attempts.set(ip, cur);
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  attempts.delete(ip);
  res.cookie('sid', makeToken(SESSION_SECRET, SESSION_TTL), {
    httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: SESSION_TTL, path: '/'
  });
  res.json({ ok: true });
});
// GET /api/login — проверка сессии без 401 (чтобы фронт не шумел в консоли)
app.get('/api/login', (req, res) => res.json({ ok: checkToken(SESSION_SECRET, req.cookies?.sid) }));
app.use('/api', (req, res, next) => {
  if (checkToken(SESSION_SECRET, req.cookies?.sid)) return next();
  res.status(401).json({ error: 'Требуется вход' });
});
app.post('/api/logout', (req, res) => {
  res.clearCookie('sid', { path: '/' });
  res.json({ ok: true });
});
app.get('/api/me', (req, res) => {
  res.json({ ok: true, login: ADMIN_LOGIN, tz: TZ, public_url: PUBLIC_URL, webhook_ready: !!(PUBLIC_URL && WEBHOOK_SECRET), self_connect: !!PARTNER_TOKEN, max_numbers: MAX_NUMBERS, min_delay: worker.MIN_DELAY_SEC });
});

// ───────── Номера ─────────
const getInstance = async (id) => {
  const inst = await db.prepare('SELECT * FROM instances WHERE id = ?').get(Number(id));
  if (!inst) throw new HttpError(404, 'Номер не найден');
  return inst;
};
// Статистика отправок по номерам: всего за всё время и по дням за последнюю неделю
const EMPTY_STATS = { sent_total: 0, delivered_total: 0, read_total: 0, failed_total: 0, replied_total: 0 };
async function instanceStats(onlyId = null) {
  const where = onlyId ? 'instance_id = ?' : 'instance_id IS NOT NULL';
  const args = onlyId ? [onlyId] : [];
  const totals = await db.prepare(`SELECT instance_id,
      COUNT(*) FILTER (WHERE status IN ('sent', 'delivered', 'read')) AS sent_total,
      COUNT(*) FILTER (WHERE status IN ('delivered', 'read')) AS delivered_total,
      COUNT(*) FILTER (WHERE status = 'read') AS read_total,
      COUNT(*) FILTER (WHERE status IN ('failed', 'no_wa')) AS failed_total,
      COUNT(*) FILTER (WHERE replied = 1) AS replied_total
    FROM messages WHERE ${where} GROUP BY instance_id`).all(...args);
  const days = Array.from({ length: 7 }, (_, k) => dayInTz(Date.now() - (6 - k) * 86400000));
  const counts = await db.prepare(`SELECT instance_id, day, count FROM daily_counts WHERE day >= ?${onlyId ? ' AND instance_id = ?' : ''}`).all(days[0], ...args);
  const map = new Map();
  const slot = (id) => {
    if (!map.has(id)) map.set(id, { ...EMPTY_STATS, week: days.map((day) => ({ day, count: 0 })) });
    return map.get(id);
  };
  for (const { instance_id, ...t } of totals) Object.assign(slot(instance_id), Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Number(v)])));
  for (const c of counts) {
    const d = slot(c.instance_id).week.find((x) => x.day === c.day);
    if (d) d.count = Number(c.count);
  }
  return { get: (id) => slot(id) };
}
async function instanceView(inst, today = dayInTz(), stats = null) {
  const { api_token, ...rest } = inst;
  return {
    ...rest,
    token_tail: api_token.slice(-4),
    sent_today: await worker.sentToday(inst.id, today),
    limit_today: worker.dailyLimit(inst, today),
    ...worker.nextSend(inst.id),
    server_now: Date.now(),
    ...(stats || await instanceStats(inst.id)).get(inst.id)
  };
}
const webhookUrl = () => `${PUBLIC_URL}/webhook/${WEBHOOK_SECRET}`;
async function installWebhook(inst) {
  if (!PUBLIC_URL || !WEBHOOK_SECRET) throw bad('Задайте PUBLIC_URL и WEBHOOK_SECRET в .env — без них вебхуки не работают');
  await client(inst).setSettings({
    webhookUrl: webhookUrl(), outgoingWebhook: 'yes', stateWebhook: 'yes', incomingWebhook: 'yes'
  });
}
const greenError = (e) => new HttpError(e.status === 401 || e.status === 403 ? 400 : 502, `GREEN-API: ${e.message}`);

app.get('/api/instances', async (req, res) => {
  const today = dayInTz();
  const stats = await instanceStats();
  res.json(await Promise.all((await db.prepare('SELECT * FROM instances ORDER BY id').all()).map((i) => instanceView(i, today, stats))));
});

// Разбор данных, скопированных из кабинета GREEN-API одним куском (apiUrl, idInstance, apiTokenInstance)
function parseInstanceText(raw) {
  const text = String(raw || '').slice(0, 5000);
  const pick = (labelled, fallback) => (text.match(labelled) || text.match(fallback) || [])[1] || '';
  return {
    api_url: pick(/apiUrl["'\s:=]*(https?:\/\/[^\s"',]+)/i, /(https?:\/\/[^\s"',]+)/i),
    id_instance: pick(/idInstance["'\s:=]*(\d{4,20})/i, /(?<![\w.])(\d{8,20})(?![\w.])/),
    api_token: pick(/apiTokenInstance["'\s:=]*([A-Za-z0-9]{20,200})/i, /(?<![A-Za-z0-9])([a-f0-9]{30,200})(?![A-Za-z0-9])/i)
  };
}

app.post('/api/instances', wrap(async (req, res) => {
  const b = req.body || {};
  const pasted = b.raw !== undefined;
  const src = pasted ? parseInstanceText(b.raw) : b;
  const inst = {
    name: String(b.name || '').trim().slice(0, 80),
    id_instance: String(src.id_instance || '').trim(),
    api_token: String(src.api_token || '').trim(),
    api_url: String(src.api_url || '').trim().replace(/\/+$/, '') || DEFAULT_API_URL
  };
  if (pasted && (!inst.id_instance || !inst.api_token)) {
    throw bad('Не нашли в тексте idInstance и apiTokenInstance. Скопируйте данные из карточки инстанса в кабинете GREEN-API целиком или заполните поля по одному.');
  }
  if (!/^\d{4,20}$/.test(inst.id_instance)) throw bad('idInstance должен состоять из цифр');
  if (!/^[A-Za-z0-9]{6,200}$/.test(inst.api_token)) throw bad('Укажите apiTokenInstance');
  if (!/^https?:\/\/[^\s/]+/.test(inst.api_url)) throw bad('apiUrl должен начинаться с http(s)://');
  if (!inst.name) inst.name = `Номер ${inst.id_instance}`;
  if (await db.prepare('SELECT 1 FROM instances WHERE id_instance = ?').get(inst.id_instance)) throw bad('Этот инстанс уже добавлен');

  let state;
  try {
    state = (await client(inst).getStateInstance())?.stateInstance || 'unknown'; // проверка кредов
  } catch (e) {
    if (/expired/i.test(e.message)) throw bad('Это подключение GREEN-API не оплачено (срок истёк). Продлите его в кабинете GREEN-API и добавьте снова.');
    if (e.status === 401 || e.status === 403) throw bad('GREEN-API не принял данные. Проверьте, что idInstance и apiTokenInstance скопированы полностью.');
    throw new HttpError(400, `Не удалось проверить доступ: ${e.message}`);
  }
  let webhook = 'skipped';
  if (PUBLIC_URL && WEBHOOK_SECRET) {
    try {await installWebhook(inst);webhook = 'ok';} catch (e) {webhook = e.message;}
  }
  const id = (await db.prepare(`INSERT INTO instances(name, id_instance, api_token, api_url, state, created_at)
    VALUES (@name, @id_instance, @api_token, @api_url, @state, @created_at)`).
  run({ ...inst, state, created_at: Date.now() })).lastInsertRowid;
  await logEvent(`Добавлен номер «${inst.name}» (инстанс ${inst.id_instance}), состояние: ${state}`, 'info', Number(id));
  const saved = await getInstance(id);
  if (state === 'authorized') await worker.refreshInstance(saved).catch(() => {});
  res.json({ ...(await instanceView(await getInstance(id))), webhook });
}));

// «Подключить номер» одной кнопкой: берём свободное подключение, а если их нет — создаём новое
app.post('/api/numbers/connect', wrap(async (req, res) => {
  const free = await db.prepare("SELECT * FROM instances WHERE state <> 'authorized' AND state NOT IN ('blocked', 'yellowCard') ORDER BY id LIMIT 1").get();
  if (free) return res.json({ ...(await instanceView(free)), created: false });
  const total = (await db.prepare('SELECT COUNT(*) n FROM instances').get()).n;
  // «мест нет» — штатная ситуация, а не ошибка: отвечаем 200 с понятным текстом
  if (!PARTNER_TOKEN) return res.json({ full: true, message: 'Свободных подключений нет. Добавьте ещё одно по ссылке «Добавить подключение GREEN-API вручную» внизу страницы.' });
  if (total >= MAX_NUMBERS) return res.json({ full: true, message: `Подключено максимальное число номеров (${MAX_NUMBERS}).` });
  const name = `Номер ${total + 1}`;
  const settings = { name: `Uved ${name}` };
  if (PUBLIC_URL && WEBHOOK_SECRET) Object.assign(settings, { webhookUrl: webhookUrl(), outgoingWebhook: 'yes', stateWebhook: 'yes', incomingWebhook: 'yes' });
  const created = await partnerCall('createInstance', settings);
  if (!created?.idInstance || !created?.apiTokenInstance) throw new HttpError(502, 'GREEN-API не создал подключение. Попробуйте ещё раз позже.');
  const id = (await db.prepare(`INSERT INTO instances(name, id_instance, api_token, api_url, state, managed, created_at)
    VALUES (?, ?, ?, ?, 'starting', 1, ?)`).run(name, String(created.idInstance), String(created.apiTokenInstance), PARTNER_URL, Date.now())).lastInsertRowid;
  await logEvent(`Создано подключение «${name}» (инстанс ${created.idInstance}) через партнёрский API`, 'info', Number(id));
  res.json({ ...(await instanceView(await getInstance(id))), created: true });
}));

app.patch('/api/instances/:id', async (req, res) => {
  const inst = await getInstance(req.params.id);
  const b = req.body || {};
  const next = {
    name: b.name !== undefined ? String(b.name).trim().slice(0, 80) || inst.name : inst.name,
    daily_limit_start: b.daily_limit_start !== undefined ? int(b.daily_limit_start, inst.daily_limit_start, 1, 5000) : inst.daily_limit_start,
    daily_limit_max: b.daily_limit_max !== undefined ? int(b.daily_limit_max, inst.daily_limit_max, 1, 5000) : inst.daily_limit_max,
    warmup_step: b.warmup_step !== undefined ? int(b.warmup_step, inst.warmup_step, 0, 1000) : inst.warmup_step
  };
  if (next.daily_limit_max < next.daily_limit_start) next.daily_limit_max = next.daily_limit_start;
  await db.prepare('UPDATE instances SET name = ?, daily_limit_start = ?, daily_limit_max = ?, warmup_step = ? WHERE id = ?').
  run(next.name, next.daily_limit_start, next.daily_limit_max, next.warmup_step, inst.id);
  if (b.enabled !== undefined) {
    const on = b.enabled ? 1 : 0;
    await db.prepare('UPDATE instances SET enabled = ?, disabled_reason = ? WHERE id = ?').run(on, on ? null : 'Выключен вручную', inst.id);
    worker.resetInstance(inst.id);
    if (on !== inst.enabled) await logEvent(`Номер «${next.name}» ${on ? 'включён' : 'выключен'} вручную`, 'info', inst.id);
  }
  res.json(await instanceView(await getInstance(inst.id)));
});

app.post('/api/instances/:id/refresh', wrap(async (req, res) => {
  const inst = await getInstance(req.params.id);
  try {await worker.refreshInstance(inst);} catch (e) {throw greenError(e);}
  res.json(await instanceView(await getInstance(inst.id)));
}));

app.get('/api/instances/:id/qr', wrap(async (req, res) => {
  const inst = await getInstance(req.params.id);
  let r;
  try {r = await client(inst).qr();} catch (e) {throw greenError(e);}
  if (r?.type === 'alreadyLogged') await worker.refreshInstance(inst).catch(() => {});
  res.json({ type: r?.type || 'error', message: r?.message || '' });
}));

// Подключение без камеры: WhatsApp выдаёт код, который вводят на телефоне
app.post('/api/instances/:id/auth-code', wrap(async (req, res) => {
  const inst = await getInstance(req.params.id);
  const phone = normalizePhone(req.body?.phone);
  if (!phone) throw bad('Введите номер телефона с кодом страны, например +7 701 123 45 67');
  let r;
  try {r = await client(inst).getAuthorizationCode(phone);} catch (e) {throw greenError(e);}
  if (!r?.status || !r?.code) throw bad('WhatsApp не выдал код. Проверьте номер телефона или подключите по QR-коду.');
  res.json({ code: String(r.code), phone });
}));

app.post('/api/instances/:id/logout', wrap(async (req, res) => {
  const inst = await getInstance(req.params.id);
  try {await client(inst).logout();} catch (e) {throw greenError(e);}
  await worker.applyState(inst.id, 'notAuthorized', null);
  await logEvent(`Номер «${inst.name}» отвязан (logout)`, 'warn', inst.id);
  res.json(await instanceView(await getInstance(inst.id)));
}));

app.post('/api/instances/:id/webhook', wrap(async (req, res) => {
  const inst = await getInstance(req.params.id);
  try {await installWebhook(inst);} catch (e) {throw e instanceof HttpError ? e : greenError(e);}
  await logEvent(`Номер «${inst.name}»: webhook переустановлен`, 'info', inst.id);
  res.json({ ok: true, url: `${PUBLIC_URL}/webhook/…` });
}));

app.post('/api/instances/:id/test', wrap(async (req, res) => {
  const inst = await getInstance(req.params.id);
  const phone = normalizePhone(req.body?.phone);
  const text = String(req.body?.text || '').trim();
  if (inst.state !== 'authorized' || !inst.enabled) throw bad('Этот номер WhatsApp сейчас не подключён');
  if (!phone) throw bad('Некорректный номер телефона');
  if (!text) throw bad('Введите текст сообщения');
  if (text.length > 4000) throw bad('Сообщение не должно быть длиннее 4000 символов');
  if (await db.prepare('SELECT 1 FROM contacts WHERE phone = ? AND opted_out = 1').get(phone))
  throw bad('Получатель отписался от сообщений');
  let r;
  try {r = await client(inst).sendMessage(phone, text);} catch (e) {throw greenError(e);}
  await db.prepare('INSERT INTO outbox(instance_id, phone, text, created_at) VALUES (?, ?, ?, ?)').run(inst.id, phone, text, Date.now());
  await logEvent(`Тестовая отправка с «${inst.name}» на ${phone}`, 'info', inst.id);
  res.json({ ok: true, idMessage: r?.idMessage });
}));

app.delete('/api/instances/:id', wrap(async (req, res) => {
  const inst = await getInstance(req.params.id);
  let warning = null;
  if (inst.managed && PARTNER_TOKEN) {
    // подключение создавали мы — удаляем его и в GREEN-API, чтобы за него не списывалась оплата
    try {await partnerCall('deleteInstanceAccount', { idInstance: Number(inst.id_instance) });} catch (e) {warning = e.message;}
  }
  await db.transaction(async () => {
    await db.prepare('DELETE FROM instances WHERE id = ?').run(inst.id);
    await db.prepare('DELETE FROM daily_counts WHERE instance_id = ?').run(inst.id);
  })();
  await logEvent(`Номер «${inst.name}» удалён${warning ? ` (в GREEN-API удалить не удалось: ${warning})` : ''}`, 'warn');
  res.json({ ok: true, warning });
}));

// ───────── Базы и импорт ─────────
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024, files: 1 } });
const fixName = (s) => Buffer.from(String(s || ''), 'latin1').toString('utf8'); // multer отдаёт имя в latin1
const fileHash = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

app.post('/api/import-standard/preview', upload.single('file'), async (req, res) => {
  if (!req.file) throw bad('Выберите файл Excel .xlsx');
  const parsed = parseStandardFile(req.file.buffer, fixName(req.file.originalname));
  const optedOut = new Set((await db.prepare('SELECT phone FROM contacts WHERE opted_out = 1').all()).map((r) => r.phone));
  const recipients = parsed.contacts.filter((c) => !optedOut.has(c.phone));
  res.json({
    hash: fileHash(req.file.buffer),
    rows: parsed.rows,
    valid: parsed.contacts.length,
    duplicates: parsed.duplicates,
    invalid: parsed.invalid,
    invalid_examples: parsed.invalidExamples,
    opted_out: parsed.contacts.length - recipients.length,
    recipients: recipients.length,
    phone_column: 'Телефон (колонка A)',
    sample: recipients.slice(0, 10).map((c) => ({ phone: c.phone, name: c.name })),
    can_import: recipients.length > 0 && parsed.invalid === 0
  });
});

app.post('/api/import-standard', upload.single('file'), async (req, res) => {
  if (!req.file) throw bad('Выберите файл Excel .xlsx');
  const filename = fixName(req.file.originalname);
  const parsed = parseStandardFile(req.file.buffer, filename);
  if (parsed.invalid) throw bad(`Исправьте строки без корректного телефона: ${parsed.invalid}`);
  if (!parsed.contacts.length) throw bad('Добавьте хотя бы один номер в шаблон');
  if (String(req.body?.hash || '') !== fileHash(req.file.buffer)) throw bad('Файл изменился после проверки. Проверьте его ещё раз');
  const listName = String(req.body?.name || '').trim().slice(0, 120) || filename.replace(/\.xlsx$/i, '');
  const result = await importFile(req.file.buffer, filename, listName, parseStandardFile);
  await logEvent(`Импорт «${listName}» по шаблону: получателей ${result.valid - result.opted_out}, дублей ${result.duplicates}`);
  res.json(result);
});

app.get('/api/lists', async (req, res) => {
  res.json(await db.prepare(`SELECT l.*, (SELECT COUNT(*) FROM list_contacts lc WHERE lc.list_id = l.id) AS contacts
    FROM lists l ORDER BY l.id DESC`).all());
});

app.get('/api/lists/:id/recipients.csv', async (req, res) => {
  const list = await db.prepare('SELECT id FROM lists WHERE id = ?').get(Number(req.params.id));
  if (!list) throw new HttpError(404, 'База не найдена');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.attachment('recipients.csv');
  res.write('\uFEFF' + ['Телефон', 'Имя', 'Город'].map(csvCell).join(';') + '\r\n');
  const rows = await db.prepare(`SELECT c.phone, c.name, c.vars FROM list_contacts lc
    JOIN contacts c ON c.id = lc.contact_id
    WHERE lc.list_id = ? AND c.opted_out = 0 ORDER BY lc.contact_id`).all(list.id);
  for (const row of rows) {
    const vars = JSON.parse(row.vars || '{}');
    res.write([`+${row.phone}`, row.name, vars['город'] || ''].map(csvCell).join(';') + '\r\n');
  }
  res.end();
});

app.post('/api/import', upload.single('file'), async (req, res) => {
  if (!req.file) throw bad('Файл не получен');
  const filename = fixName(req.file.originalname);
  if (!/\.(xlsx|xls|csv|txt)$/i.test(filename)) throw bad('Поддерживаются файлы XLSX и CSV');
  const listName = String(req.body?.name || '').trim().slice(0, 120) || filename.replace(/\.[^.]+$/, '');
  const result = await importFile(req.file.buffer, filename, listName);
  await logEvent(`Импорт «${listName}»: строк ${result.rows}, новых ${result.new}, уже было ${result.existing}, ` +
  `дублей ${result.duplicates}, невалидных ${result.invalid} (${result.ms} мс)`);
  res.json(result);
});

// Импорт из Google Таблиц по ссылке (таблица должна быть открыта «всем, у кого есть ссылка»)
const GSHEETS_BASE = String(process.env.GSHEETS_EXPORT_BASE || 'https://docs.google.com').replace(/\/+$/, '');
app.post('/api/import-url', wrap(async (req, res) => {
  const link = String(req.body?.url || '').trim();
  const m = link.match(/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/);
  if (!m) throw bad('Это не ссылка на Google Таблицу. Скопируйте адрес из строки браузера — он начинается с docs.google.com/spreadsheets/…');
  const gid = (link.match(/[#&?]gid=(\d+)/) || [])[1];
  const exportUrl = `${GSHEETS_BASE}/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
  let r;
  try {
    r = await fetch(exportUrl, { redirect: 'follow', signal: AbortSignal.timeout(60000) });
  } catch {
    throw new HttpError(502, 'Не удалось связаться с Google. Попробуйте ещё раз.');
  }
  const type = r.headers.get('content-type') || '';
  if (!r.ok || !/csv|octet-stream|text\/plain/.test(type)) {
    throw bad('Нет доступа к таблице. Откройте её в Google Таблицах: «Настройки доступа» → «Все, у кого есть ссылка» → «Читатель», и повторите.');
  }
  const buffer = Buffer.from(await r.arrayBuffer());
  if (buffer.length > 100 * 1024 * 1024) throw bad('Таблица слишком большая');
  const cd = r.headers.get('content-disposition') || '';
  let title = '';
  try {title = decodeURIComponent((cd.match(/filename\*=UTF-8''([^;]+)/i) || [])[1] || '');} catch {/* пусто */}
  title = title.replace(/\.csv$/i, '');
  const listName = String(req.body?.name || '').trim().slice(0, 120) || title.slice(0, 120) || `Google Таблица ${new Date().toLocaleDateString('ru-RU', { timeZone: TZ })}`;
  const result = await importFile(buffer, 'sheet.csv', listName);
  await logEvent(`Импорт из Google Таблицы «${listName}»: строк ${result.rows}, новых ${result.new}, уже было ${result.existing}, ` +
  `дублей ${result.duplicates}, невалидных ${result.invalid}`);
  res.json(result);
}));

// ───────── Шаблоны сообщений ─────────
const templateInput = (b) => {
  const name = String(b?.name || '').trim().slice(0, 120);
  const text = String(b?.text || '').slice(0, 4000);
  if (!name) throw bad('Укажите название шаблона');
  if (!text.trim()) throw bad('Введите текст шаблона');
  return { name, text };
};
app.get('/api/templates', async (req, res) => res.json(await db.prepare('SELECT * FROM templates ORDER BY id DESC').all()));
app.post('/api/templates', async (req, res) => {
  const t = templateInput(req.body);
  const id = (await db.prepare('INSERT INTO templates(name, text, created_at) VALUES (?, ?, ?)').run(t.name, t.text, Date.now())).lastInsertRowid;
  res.json(await db.prepare('SELECT * FROM templates WHERE id = ?').get(id));
});
app.put('/api/templates/:id', async (req, res) => {
  const t = templateInput(req.body);
  const r = await db.prepare('UPDATE templates SET name = ?, text = ? WHERE id = ?').run(t.name, t.text, Number(req.params.id));
  if (!r.changes) throw new HttpError(404, 'Шаблон не найден');
  res.json(await db.prepare('SELECT * FROM templates WHERE id = ?').get(Number(req.params.id)));
});
app.delete('/api/templates/:id', async (req, res) => {
  await db.prepare('DELETE FROM templates WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

app.delete('/api/lists/:id', async (req, res) => {
  const id = Number(req.params.id);
  const list = await db.prepare('SELECT * FROM lists WHERE id = ?').get(id);
  if (!list) throw new HttpError(404, 'База не найдена');
  const used = await db.prepare("SELECT name FROM campaigns WHERE list_id = ? AND status IN ('draft', 'running', 'paused') LIMIT 1").get(id);
  if (used) throw bad(`База используется в кампании «${used.name}». Сначала завершите или удалите кампанию.`);
  const removed = await db.transaction(async () => {
    // контакты, которые были только в этой базе, без истории и не в стоп-листе, удаляем вместе с ней
    const r = await db.prepare(`DELETE FROM contacts WHERE opted_out = 0
      AND id IN (SELECT contact_id FROM list_contacts WHERE list_id = @id)
      AND NOT EXISTS (SELECT 1 FROM list_contacts o WHERE o.contact_id = contacts.id AND o.list_id <> @id)
      AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.contact_id = contacts.id)`).run({ id });
    await db.prepare('DELETE FROM list_contacts WHERE list_id = ?').run(id);
    await db.prepare('DELETE FROM lists WHERE id = ?').run(id);
    return r.changes;
  })();
  await logEvent(`База «${list.name}» удалена, контактов удалено: ${removed}`, 'warn');
  res.json({ ok: true, removed });
});

// ───────── Кампании ─────────
const getCampaign = async (id) => {
  const c = await db.prepare('SELECT * FROM campaigns WHERE id = ?').get(Number(id));
  if (!c) throw new HttpError(404, 'Кампания не найдена');
  return c;
};
const parseIds = (json) => {try {return JSON.parse(json) || [];} catch {return [];}};

async function campaignStats(c, instances, today) {
  const rows = await db.prepare('SELECT status, COUNT(*) n, SUM(replied) r FROM messages WHERE campaign_id = ? GROUP BY status').all(c.id);
  const by = {};
  let total = 0;
  let replied = 0;
  for (const r of rows) {by[r.status] = r.n;total += r.n;replied += r.r || 0;}
  const g = (k) => by[k] || 0;
  const queue = g('pending') + g('sending');
  // ETA: день за днём с учётом прогрева, окна отправки и средней паузы
  const ids = parseIds(c.instance_ids);
  const mine = instances.filter((i) => i.enabled && (!ids.length || ids.includes(i.id)));
  let eta = null;
  if (queue > 0 && mine.length) {
    const avgDelay = Math.max(1, (Math.max(c.delay_min, worker.MIN_DELAY_SEC) + Math.max(c.delay_max, c.delay_min, worker.MIN_DELAY_SEC)) / 2);
    const windowCap = Math.max(1, Math.floor((c.hour_to - c.hour_from) * 3600 / avgDelay));
    let left = queue;
    eta = 0;
    while (left > 0 && eta < 3650) {
      let cap = 0;
      for (const i of mine) {
        const days = (i.first_send_day ? Math.max(0, daysBetween(i.first_send_day, today)) : 0) + eta;
        cap += Math.min(windowCap, i.daily_limit_max, i.daily_limit_start + i.warmup_step * days);
      }
      if (cap <= 0) {eta = null;break;}
      left -= cap;
      eta++;
    }
  }
  return {
    total,
    sent: g('sent') + g('delivered') + g('read'),
    delivered: g('delivered') + g('read'),
    read: g('read'),
    replied,
    failed: g('failed'),
    no_wa: g('no_wa'),
    skipped: g('skipped'),
    queue,
    eta_days: eta,
    daily_capacity: mine.reduce((n, i) => n + worker.dailyLimit(i, today), 0)
  };
}
async function campaignView(c, instances, today) {
  return { ...c, instance_ids: parseIds(c.instance_ids), extra_texts: parseIds(c.extra_texts), stats: await campaignStats(c, instances, today) };
}
async function campaignInput(b, prev) {
  const minDelay = worker.MIN_DELAY_SEC;
  const out = {
    name: String(b.name ?? prev?.name ?? '').trim().slice(0, 120),
    text: String(b.text ?? prev?.text ?? '').slice(0, 4000),
    extra_texts: JSON.stringify((Array.isArray(b.extra_texts) ? b.extra_texts : parseIds(prev?.extra_texts || '[]')).
    map((t) => String(t ?? '').slice(0, 4000)).filter((t) => t.trim()).slice(0, 9)),
    media_url: b.media_url !== undefined ? String(b.media_url || '').trim() || null : prev?.media_url ?? null,
    media_name: b.media_name !== undefined ? String(b.media_name || '').trim().slice(0, 200) || null : prev?.media_name ?? null,
    list_id: b.list_id !== undefined ? b.list_id === null || b.list_id === '' ? null : Number(b.list_id) : prev?.list_id ?? null,
    instance_ids: b.instance_ids !== undefined ? b.instance_ids : parseIds(prev?.instance_ids || '[]'),
    delay_min: int(b.delay_min ?? prev?.delay_min, 120, minDelay, 3600),
    delay_max: int(b.delay_max ?? prev?.delay_max, 240, minDelay, 7200),
    hour_from: int(b.hour_from ?? prev?.hour_from, 10, 0, 23),
    hour_to: int(b.hour_to ?? prev?.hour_to, 20, 1, 24),
    check_wa: (b.check_wa !== undefined ? b.check_wa : prev?.check_wa) ? 1 : 0
  };
  const extras = parseIds(out.extra_texts);
  if (!out.text.trim() && extras.length) { // основной текст пуст — первым становится следующий вариант
    out.text = extras.shift();
    out.extra_texts = JSON.stringify(extras);
  }
  if (!out.name) throw bad('Укажите название кампании');
  if (!out.text.trim() && !out.media_url) throw bad('Добавьте текст сообщения или файл');
  if (out.media_url && !/^https?:\/\//.test(out.media_url)) throw bad('Ссылка на файл должна начинаться с http(s)://');
  if (!out.media_url) out.media_name = null;
  if (out.delay_max < out.delay_min) out.delay_max = out.delay_min;
  if (out.hour_to <= out.hour_from) throw bad('Окно отправки: час «до» должен быть больше часа «с»');
  if (out.list_id !== null && !(await db.prepare('SELECT 1 FROM lists WHERE id = ?').get(out.list_id))) throw bad('База не найдена');
  if (!Array.isArray(out.instance_ids)) throw bad('Некорректный список номеров');
  const known = new Set((await db.prepare('SELECT id FROM instances').all()).map((i) => i.id));
  out.instance_ids = [...new Set(out.instance_ids.map(Number))].filter((id) => known.has(id));
  if (!out.instance_ids.length) throw bad('Выберите хотя бы один номер для отправки');
  out.instance_ids = JSON.stringify(out.instance_ids);
  return out;
}

app.get('/api/campaigns', async (req, res) => {
  const instances = await db.prepare('SELECT * FROM instances').all();
  const today = dayInTz();
  res.json(await Promise.all((await db.prepare('SELECT * FROM campaigns ORDER BY id DESC').all()).map((c) => campaignView(c, instances, today))));
});
const sendCampaign = async (res, id) => res.json(await campaignView(await getCampaign(id), await db.prepare('SELECT * FROM instances').all(), dayInTz()));
app.get('/api/campaigns/:id', async (req, res) => await sendCampaign(res, req.params.id));

app.post('/api/campaigns', async (req, res) => {
  const c = await campaignInput(req.body || {}, null);
  const id = (await db.prepare(`INSERT INTO campaigns(name, text, extra_texts, media_url, media_name, list_id, instance_ids, delay_min, delay_max, hour_from, hour_to, check_wa, created_at)
    VALUES (@name, @text, @extra_texts, @media_url, @media_name, @list_id, @instance_ids, @delay_min, @delay_max, @hour_from, @hour_to, @check_wa, @created_at)`).
  run({ ...c, created_at: Date.now() })).lastInsertRowid;
  await sendCampaign(res, id);
});

app.put('/api/campaigns/:id', async (req, res) => {
  const prev = await getCampaign(req.params.id);
  if (prev.status === 'running') throw bad('Сначала поставьте кампанию на паузу');
  const b = { ...(req.body || {}) };
  if (prev.status !== 'draft') delete b.list_id; // базу можно менять только в черновике
  const c = await campaignInput(b, prev);
  await db.prepare(`UPDATE campaigns SET name=@name, text=@text, extra_texts=@extra_texts, media_url=@media_url, media_name=@media_name, list_id=@list_id,
    instance_ids=@instance_ids, delay_min=@delay_min, delay_max=@delay_max, hour_from=@hour_from, hour_to=@hour_to, check_wa=@check_wa
    WHERE id=@id`).run({ ...c, id: prev.id });
  await sendCampaign(res, prev.id);
});

// Перерыв между сообщениями можно менять прямо во время рассылки
app.post('/api/campaigns/:id/pace', async (req, res) => {
  const c = await getCampaign(req.params.id);
  if (!['draft', 'running', 'paused'].includes(c.status)) throw bad('Рассылка уже завершена');
  const lo = int(req.body?.delay_min, c.delay_min, Math.max(1, worker.MIN_DELAY_SEC), 3600);
  const hi = Math.max(lo, int(req.body?.delay_max, c.delay_max, lo, 7200));
  await db.prepare('UPDATE campaigns SET delay_min = ?, delay_max = ? WHERE id = ?').run(lo, hi, c.id);
  worker.applyPace(parseIds(c.instance_ids), { delay_min: lo, delay_max: hi });
  await logEvent(`Рассылка «${c.name}»: перерыв между сообщениями изменён на ${Math.round(lo / 60)}–${Math.round(hi / 60)} мин`);
  await sendCampaign(res, c.id);
});

app.delete('/api/campaigns/:id', async (req, res) => {
  const c = await getCampaign(req.params.id);
  if (c.status === 'running') throw bad('Сначала остановите кампанию');
  await db.transaction(async () => {
    await db.prepare('DELETE FROM messages WHERE campaign_id = ?').run(c.id);
    await db.prepare('DELETE FROM campaigns WHERE id = ?').run(c.id);
  })();
  await logEvent(`Кампания «${c.name}» удалена`, 'warn');
  res.json({ ok: true });
});

// Превью текста на 3 случайных контактах
app.post('/api/preview', async (req, res) => {
  const text = String(req.body?.text || '');
  const listId = req.body?.list_id ? Number(req.body.list_id) : null;
  const rows = listId ? await
  db.prepare(`SELECT c.* FROM contacts c JOIN list_contacts lc ON lc.contact_id = c.id
        WHERE lc.list_id = ? AND c.opted_out = 0 ORDER BY RANDOM() LIMIT 3`).all(listId) : await
  db.prepare('SELECT * FROM contacts WHERE opted_out = 0 ORDER BY RANDOM() LIMIT 3').all();
  res.json(rows.map((c) => {
    let vars = {};
    try {vars = JSON.parse(c.vars);} catch {/* пусто */}
    return { phone: c.phone, name: c.name, text: renderTemplate(text, { ...vars, name: c.name, phone: c.phone }) };
  }));
});

app.post('/api/campaigns/:id/start', async (req, res) => {
  const c = await getCampaign(req.params.id);
  if (c.status !== 'draft') throw bad('Запустить можно только черновик');
  const days = int(req.body?.exclude_recent_days, 0, 0, 3650);
  const conds = ['c.opted_out = 0'];
  const args = [c.id];
  if (c.list_id !== null) {conds.push('c.id IN (SELECT contact_id FROM list_contacts WHERE list_id = ?)');args.push(c.list_id);}
  if (days > 0) {
    conds.push(`NOT EXISTS (SELECT 1 FROM messages m WHERE m.contact_id = c.id
      AND m.status IN ('sent', 'delivered', 'read') AND m.sent_at >= ?)`);
    args.push(Date.now() - days * 86400000);
  }
  const added = await db.transaction(async () => {
    const r = await db.prepare(`INSERT OR IGNORE INTO messages(campaign_id, contact_id, phone, status)
      SELECT ?, c.id, c.phone, 'pending' FROM contacts c WHERE ${conds.join(' AND ')} ORDER BY c.id`).run(...args);
    if (r.changes) await db.prepare("UPDATE campaigns SET status = 'running', started_at = ? WHERE id = ?").run(Date.now(), c.id);
    return r.changes;
  })();
  if (!added) throw bad('Нет получателей: база пуста, все в стоп-листе или всем уже писали недавно');
  await logEvent(`Кампания «${c.name}» запущена, получателей: ${added}`);
  await sendCampaign(res, c.id);
});

function transition(action, from, to, label) {
  app.post(`/api/campaigns/:id/${action}`, async (req, res) => {
    const c = await getCampaign(req.params.id);
    if (!from.includes(c.status)) throw bad(`Действие недоступно в статусе «${c.status}»`);
    await db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run(to, c.id);
    await logEvent(`Кампания «${c.name}»: ${label}`);
    await sendCampaign(res, c.id);
  });
}
transition('pause', ['running'], 'paused', 'пауза');
transition('resume', ['paused'], 'running', 'продолжена');
transition('stop', ['running', 'paused'], 'stopped', 'остановлена');

app.post('/api/campaigns/:id/retry', async (req, res) => {
  const c = await getCampaign(req.params.id);
  if (c.status === 'draft') throw bad('Кампания ещё не запускалась');
  const n = await db.transaction(async () => {
    const r = await db.prepare("UPDATE messages SET status = 'pending', error = NULL, id_message = NULL WHERE campaign_id = ? AND status = 'failed'").run(c.id);
    if (r.changes && c.status !== 'paused') await db.prepare("UPDATE campaigns SET status = 'running', finished_at = NULL WHERE id = ?").run(c.id);
    return r.changes;
  })();
  if (!n) throw bad('В кампании нет сообщений с ошибками');
  await logEvent(`Кампания «${c.name}»: повтор ошибок, сообщений: ${n}`);
  await sendCampaign(res, c.id);
});

const MESSAGE_STATUSES = ['pending', 'sending', 'sent', 'delivered', 'read', 'failed', 'no_wa', 'skipped'];
function messageFilter(c, q) {
  const conds = ['m.campaign_id = ?'];
  const args = [c.id];
  if (MESSAGE_STATUSES.includes(q.status)) {conds.push('m.status = ?');args.push(q.status);}
  if (q.replied === '1') conds.push('m.replied = 1');
  return { where: conds.join(' AND '), args };
}
app.get('/api/campaigns/:id/messages', async (req, res) => {
  const c = await getCampaign(req.params.id);
  const { where, args } = messageFilter(c, req.query);
  const limit = int(req.query.limit, 50, 1, 500);
  const offset = int(req.query.offset, 0, 0, 1e9);
  const total = (await db.prepare(`SELECT COUNT(*) n FROM messages m WHERE ${where}`).get(...args)).n;
  const rows = await db.prepare(`SELECT m.id, m.phone, m.status, m.error, m.replied, m.sent_at, m.text, m.instance_id,
      ct.name AS contact_name, i.name AS instance_name
    FROM messages m LEFT JOIN contacts ct ON ct.id = m.contact_id LEFT JOIN instances i ON i.id = m.instance_id
    WHERE ${where} ORDER BY m.id LIMIT ? OFFSET ?`).all(...args, limit, offset);
  res.json({ total, rows });
});

// Экспорт CSV: UTF-8 с BOM, разделитель ;
app.get('/api/campaigns/:id/export.csv', async (req, res) => {
  const c = await getCampaign(req.params.id);
  const { where, args } = messageFilter(c, req.query);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="campaign-${c.id}.csv"`);
  res.write('﻿' + ['Телефон', 'Имя', 'Статус', 'Ответил', 'Номер отправителя', 'Отправлено', 'Ошибка', 'Текст'].map(csvCell).join(';') + '\r\n');
  const fmt = new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, dateStyle: 'short', timeStyle: 'medium' });
  const it = await db.prepare(`SELECT m.*, ct.name AS contact_name, i.name AS instance_name
    FROM messages m LEFT JOIN contacts ct ON ct.id = m.contact_id LEFT JOIN instances i ON i.id = m.instance_id
    WHERE ${where} ORDER BY m.id`).all(...args);
  let chunk = '';
  let n = 0;
  for (const m of it) {
    chunk += [m.phone, m.contact_name, m.status, m.replied ? 'да' : '', m.instance_name, m.sent_at ? fmt.format(m.sent_at) : '', m.error, m.text].
    map(csvCell).join(';') + '\r\n';
    if (++n % 2000 === 0) {res.write(chunk);chunk = '';}
  }
  res.end(chunk);
});

// ───────── Медиа ─────────
const MEDIA_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'mp3', 'ogg', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip']);
const mediaUpload = multer({
  storage: multer.diskStorage({
    destination: MEDIA_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    if (MEDIA_EXT.has(ext)) cb(null, true);else
    cb(bad(`Тип файла .${ext || '?'} не поддерживается`));
  }
});
app.post('/api/media', mediaUpload.single('file'), (req, res) => {
  if (!req.file) throw bad('Файл не получен');
  const base = PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  res.json({ url: `${base}/media/${req.file.filename}`, name: fixName(req.file.originalname), public: !!PUBLIC_URL });
});

// ───────── Ответы и стоп-лист ─────────
// ───────── Чаты: переписка с теми, кто ответил ─────────
app.get('/api/chats', async (req, res) => {
  res.json(await db.prepare(`SELECT last.phone, last.text, last.created_at AS last_at, last.is_stop, last.instance_id,
      agg.unread, agg.total, COALESCE(NULLIF(c.name, ''), last.name, '') AS name, COALESCE(c.opted_out, 0) AS opted_out
    FROM (SELECT DISTINCT ON (phone) phone, text, created_at, is_stop, instance_id, name FROM incoming ORDER BY phone, id DESC) last
    JOIN (SELECT phone, COUNT(*) FILTER (WHERE seen = 0) AS unread, COUNT(*) AS total FROM incoming GROUP BY phone) agg ON agg.phone = last.phone
    LEFT JOIN contacts c ON c.phone = last.phone
    ORDER BY last.created_at DESC LIMIT 300`).all());
});

app.get('/api/chats/:phone', async (req, res) => {
  const phone = normalizePhone(req.params.phone);
  if (!phone) throw bad('Некорректный номер телефона');
  const [inc, sent, manual, contact] = await Promise.all([
  db.prepare('SELECT text, created_at AS at, is_stop, instance_id, name FROM incoming WHERE phone = ? ORDER BY id DESC LIMIT 200').all(phone),
  db.prepare("SELECT text, sent_at AS at, status, instance_id FROM messages WHERE phone = ? AND sent_at IS NOT NULL ORDER BY sent_at DESC LIMIT 200").all(phone),
  db.prepare('SELECT text, created_at AS at, instance_id FROM outbox WHERE phone = ? ORDER BY id DESC LIMIT 200').all(phone),
  db.prepare('SELECT name, opted_out FROM contacts WHERE phone = ?').get(phone)]
  );
  await db.prepare('UPDATE incoming SET seen = 1 WHERE phone = ? AND seen = 0').run(phone);
  const items = [
  ...inc.map((m) => ({ dir: 'in', text: m.text || '', at: m.at, is_stop: m.is_stop })),
  ...sent.map((m) => ({ dir: 'out', text: m.text || '', at: m.at, status: m.status, campaign: true })),
  ...manual.map((m) => ({ dir: 'out', text: m.text, at: m.at }))].
  sort((a, b) => a.at - b.at).slice(-300);
  res.json({
    phone,
    name: contact?.name || inc[0]?.name || '',
    opted_out: contact?.opted_out ? 1 : 0,
    instance_id: inc[0]?.instance_id ?? sent[0]?.instance_id ?? manual[0]?.instance_id ?? null,
    items
  });
});

app.post('/api/chats/:phone/send', wrap(async (req, res) => {
  const phone = normalizePhone(req.params.phone);
  const text = String(req.body?.text || '').trim();
  if (!phone) throw bad('Некорректный номер телефона');
  if (!text) throw bad('Введите текст сообщения');
  if (text.length > 4000) throw bad('Сообщение не должно быть длиннее 4000 символов');
  if (await db.prepare('SELECT 1 FROM contacts WHERE phone = ? AND opted_out = 1').get(phone)) throw bad('Этот человек отписался — писать ему нельзя');
  // отвечаем с того же номера, на который человек написал; если он отключён — с любого рабочего
  const ready = await db.prepare("SELECT * FROM instances WHERE enabled = 1 AND state = 'authorized' ORDER BY id").all();
  const last = await db.prepare('SELECT instance_id FROM incoming WHERE phone = ? AND instance_id IS NOT NULL ORDER BY id DESC LIMIT 1').get(phone);
  const wanted = Number(req.body?.instance_id) || last?.instance_id;
  const inst = ready.find((i) => i.id === wanted) || ready[0];
  if (!inst) throw bad('Нет подключённого номера WhatsApp, с которого можно ответить');
  try {await client(inst).sendMessage(phone, text);} catch (e) {throw greenError(e);}
  await db.prepare('INSERT INTO outbox(instance_id, phone, text, created_at) VALUES (?, ?, ?, ?)').run(inst.id, phone, text, Date.now());
  res.json({ ok: true, instance_id: inst.id, instance_name: inst.name });
}));

app.get('/api/incoming', async (req, res) => {
  const limit = int(req.query.limit, 50, 1, 500);
  const offset = int(req.query.offset, 0, 0, 1e9);
  res.json({
    total: (await db.prepare('SELECT COUNT(*) n FROM incoming').get()).n,
    rows: await db.prepare(`SELECT n.*, i.name AS instance_name, c.name AS contact_name FROM incoming n
      LEFT JOIN instances i ON i.id = n.instance_id LEFT JOIN contacts c ON c.phone = n.phone
      ORDER BY n.id DESC LIMIT ? OFFSET ?`).all(limit, offset)
  });
});
app.get('/api/optouts', async (req, res) => {
  const limit = int(req.query.limit, 50, 1, 500);
  const offset = int(req.query.offset, 0, 0, 1e9);
  res.json({
    total: (await db.prepare('SELECT COUNT(*) n FROM contacts WHERE opted_out = 1').get()).n,
    rows: await db.prepare('SELECT phone, name, opted_out_at FROM contacts WHERE opted_out = 1 ORDER BY opted_out_at DESC LIMIT ? OFFSET ?').all(limit, offset)
  });
});
app.post('/api/optouts', async (req, res) => {
  const raw = Array.isArray(req.body?.phones) ? req.body.phones : String(req.body?.phones ?? req.body?.phone ?? '').split(/[\n,;]+/);
  const phones = [...new Set(raw.map(normalizePhone).filter(Boolean))];
  if (!phones.length) throw bad('Не найдено ни одного корректного номера');
  for (const p of phones) await optOut(p, 'добавлен вручную');
  res.json({ ok: true, added: phones.length });
});
app.delete('/api/optouts/:phone', async (req, res) => {
  const r = await db.prepare('UPDATE contacts SET opted_out = 0, opted_out_at = NULL WHERE phone = ? AND opted_out = 1').run(String(req.params.phone));
  if (!r.changes) throw new HttpError(404, 'Номер не найден в стоп-листе');
  await logEvent(`${req.params.phone} удалён из стоп-листа вручную`, 'warn');
  res.json({ ok: true });
});
app.get('/api/settings', async (req, res) => res.json({ stop_words: await getSetting('stop_words') }));
app.put('/api/settings', async (req, res) => {
  const words = String(req.body?.stop_words ?? '').split(/[,\n;]+/).map((w) => w.trim().toLowerCase()).filter(Boolean);
  await setSetting('stop_words', [...new Set(words)].join(', '));
  await logEvent('Стоп-слова обновлены');
  res.json({ stop_words: await getSetting('stop_words') });
});

// ───────── Журнал и сводка ─────────
app.get('/api/events', async (req, res) => {
  const limit = int(req.query.limit, 100, 1, 500);
  const offset = int(req.query.offset, 0, 0, 1e9);
  res.json({
    total: (await db.prepare('SELECT COUNT(*) n FROM events').get()).n,
    rows: await db.prepare(`SELECT e.*, i.name AS instance_name FROM events e LEFT JOIN instances i ON i.id = e.instance_id
      ORDER BY e.id DESC LIMIT ? OFFSET ?`).all(limit, offset)
  });
});
app.get('/api/overview', async (req, res) => {
  const today = dayInTz();
  const insts = await db.prepare('SELECT * FROM instances').all();
  const active = insts.filter((i) => i.enabled && i.state === 'authorized');
  const sentCounts = await Promise.all(insts.map((i) => worker.sentToday(i.id, today)));
  res.json({
    contacts: (await db.prepare('SELECT COUNT(*) n FROM contacts').get()).n,
    opted_out: (await db.prepare('SELECT COUNT(*) n FROM contacts WHERE opted_out = 1').get()).n,
    lists: (await db.prepare('SELECT COUNT(*) n FROM lists').get()).n,
    instances: insts.length,
    instances_active: active.length,
    instances_stopped: insts.filter((i) => !i.enabled && i.disabled_reason && i.disabled_reason !== 'Выключен вручную').length,
    sent_today: sentCounts.reduce((n, count) => n + count, 0),
    limit_today: insts.filter((i, index) => active.includes(i) || sentCounts[index] > 0).
    reduce((n, i) => n + worker.dailyLimit(i, today), 0),
    queue: (await db.prepare(`SELECT COUNT(*) n FROM messages m JOIN campaigns c ON c.id = m.campaign_id
      WHERE c.status IN ('running', 'paused') AND m.status IN ('pending', 'sending')`).get()).n,
    incoming: (await db.prepare('SELECT COUNT(*) n FROM incoming').get()).n,
    chats_unread: (await db.prepare('SELECT COUNT(DISTINCT phone) n FROM incoming WHERE seen = 0').get()).n,
    campaigns_started: (await db.prepare("SELECT COUNT(*) n FROM campaigns WHERE status <> 'draft'").get()).n
  });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Не найдено' }));

// ───────── Статика ─────────
app.use(express.static(path.join(__dirname, '..', 'dist'), { index: 'index.html' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Внутренняя ошибка';
  if (err.code === 'LIMIT_FILE_SIZE') {status = 400;message = 'Файл слишком большой (максимум 100 МБ)';}
  if (status >= 500) console.error(err);
  // HttpError — ожидаемые ответы (например, GREEN-API недоступен); в Sentry только настоящие сбои
  if (status >= 500 && !(err instanceof HttpError)) monitoring.captureError(err, 'api', { method: req.method, path: req.route?.path || req.path });
  res.status(status).json({ error: message });
});

let server;
initDb().then(() => {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pulse WhatsApp: http://localhost:${PORT} (TZ ${TZ})`);
    worker.start().catch((e) => {console.error('worker start', e);monitoring.captureError(e, 'worker-start');});
  });
}).catch(async (e) => {
  console.error('Database initialization failed', e);
  monitoring.captureError(e, 'db-init');
  await monitoring.flush();
  process.exit(1);
});
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    worker.stop();
    const exit = () => db.close().finally(() => monitoring.flush().finally(() => process.exit(0)));
    if (server) server.close(exit);
    else exit();
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
