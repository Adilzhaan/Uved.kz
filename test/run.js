'use strict';
// Сквозной тест: поднимает mock GREEN-API (:4000) и сервис (:3999) на временной базе,
// проверяет импорт 92k, лимиты, yellowCard, СТОП, завершение кампании и UI (Playwright).
// Запуск: npm test            (без UI: SKIP_UI=1 npm test)
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const XLSX = require('xlsx');
const { Pool } = require('pg');
const { writeXlsx } = require('./gen-xlsx');
const { renderTemplate, normalizePhone } = require('../src/util');
const { scrub } = require('../src/monitoring');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.TEST_PORT || 3999);
const MOCK_PORT = Number(process.env.TEST_MOCK_PORT || 4000);
const BASE = `http://127.0.0.1:${PORT}`;
const MOCK = `http://127.0.0.1:${MOCK_PORT}`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-test-'));
const children = [];
let testPool;
let testSchema;
let cookie = '';
let passed = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function ok(name) { passed++; console.log(`  ✓ ${name}`); }

function run(file, env) {
  const child = spawn(process.execPath, [file], { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (d) => process.env.VERBOSE && process.stdout.write(`[${path.basename(file)}] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[${path.basename(file)}] ${d}`));
  children.push(child);
  return child;
}
async function waitHttp(url) {
  for (let i = 0; i < 100; i++) {
    try { await fetch(url); return; } catch { await sleep(100); }
  }
  throw new Error(`Не дождались ${url}`);
}
async function call(method, url, body, raw = false) {
  const init = { method, headers: { cookie } };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
  const res = await fetch(BASE + url, init);
  if (raw) return res;
  const json = await res.json().catch(() => ({}));
  return { ...json, status: json.status ?? res.status, http: res.status, _body: json };
}
const get = (url) => call('GET', url);
const post = (url, body = {}) => call('POST', url, body);
async function until(fn, label, timeout = 60000) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > timeout) throw new Error(`Таймаут ожидания: ${label}`);
    await sleep(150);
  }
}
const mock = (pathname, body) => fetch(MOCK + pathname, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined).then((r) => r.json());
const campaign = async (id) => (await get(`/api/campaigns/${id}`))._body;
const messages = async (id, q = '') => (await get(`/api/campaigns/${id}/messages?limit=500${q}`)).rows;
const instances = async () => (await get('/api/instances'))._body;
function standardXlsx(rows) {
  const wb = XLSX.read(fs.readFileSync(path.join(ROOT, 'dist/template-contacts.xlsx')), { type: 'buffer' });
  XLSX.utils.sheet_add_aoa(wb.Sheets['Контакты'], rows, { origin: 'A2' });
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function unitTests() {
  console.log('Юнит-проверки');
  const cases = { '8 (701) 123-45-67': '77011234567', '+7 701 123 45 67': '77011234567', '7011234567': '77011234567', '9011234567': '79011234567', '901234567': '998901234567', '+998 90 123 45 67': '998901234567', '12345': null, '': null };
  for (const [k, v] of Object.entries(cases)) assert.strictEqual(normalizePhone(k), v, k);
  assert.strictEqual(normalizePhone(87011234567), '77011234567');
  ok('нормализация телефонов');
  assert.strictEqual(renderTemplate('Привет, {NAME}!  {unknown}  \nКак дела? ', { name: 'Анна' }), 'Привет, Анна!\nКак дела?');
  assert.strictEqual(renderTemplate('{a|a} {Город}', { 'город': 'Алматы' }), 'a Алматы');
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(renderTemplate('{Добрый {день|вечер}|Привет}, {name}', { name: 'Олег' }));
  assert.deepStrictEqual([...seen].sort(), ['Добрый вечер, Олег', 'Добрый день, Олег', 'Привет, Олег']);
  assert.strictEqual(renderTemplate('{name}', { name: '{a|b}' }), '{a|b}');
  ok('шаблон: переменные, вложенный спинтакс, пробелы');

  const ev = scrub({
    timestamp: 1764150000.123,
    message: 'sendMessage: HTTP 400 — bad chatId 77011234567@c.us',
    request: { url: 'https://uved.kz/webhook/whsecret123' },
    breadcrumbs: [{ data: { url: 'https://api.green-api.com/waInstance1101234567/sendMessage/abcDEF123token' } },
      { data: { url: 'https://api.green-api.com/partner/createInstance/partnerTOKEN42' } }]
  });
  assert.strictEqual(ev.timestamp, 1764150000.123, 'числа не трогаем');
  assert.strictEqual(ev.message, 'sendMessage: HTTP 400 — bad chatId 770*****67@c.us');
  assert.strictEqual(ev.request.url, 'https://uved.kz/webhook/[secret]');
  assert.strictEqual(ev.breadcrumbs[0].data.url, 'https://api.green-api.com/waInstance1101234567/sendMessage/[token]');
  assert.strictEqual(ev.breadcrumbs[1].data.url, 'https://api.green-api.com/partner/createInstance/[token]');
  ok('мониторинг: токены, секрет вебхука и телефоны вычищаются');
}

async function apiTests() {
  console.log('Авторизация');
  assert.strictEqual((await get('/health')).status, 200);
  assert.strictEqual((await get('/api/instances')).status, 401);
  assert.strictEqual((await post('/api/login', { login: 'boss', password: 'wrong' })).status, 401);
  assert.strictEqual((await post('/api/login', { login: 'other', password: 'testpass' })).status, 401);
  assert.strictEqual((await post('/api/login', { password: 'testpass' })).status, 401);
  const login = await call('POST', '/api/login', { login: 'Boss', password: 'testpass' }, true);
  assert.strictEqual(login.status, 200);
  const setCookie = login.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/i);
  cookie = setCookie.split(';')[0];
  assert.strictEqual((await get('/api/instances')).status, 200);
  ok('/api/* закрыт без cookie, вход по паролю, cookie httpOnly');

  console.log('Номера');
  const badInst = await post('/api/instances', { name: 'X', id_instance: '9001', api_token: 'badtoken', api_url: MOCK });
  assert.strictEqual(badInst.status, 400);
  const A = await post('/api/instances', { name: 'Номер A', id_instance: '1001', api_token: 'goodtoken', api_url: MOCK });
  const B = await post('/api/instances', { name: 'Номер B', id_instance: '1002', api_token: 'goodtoken', api_url: MOCK });
  assert.strictEqual(A.status, 200);
  assert.strictEqual(A.webhook, 'ok');
  assert.strictEqual(A.api_token, undefined, 'токен не должен уходить на фронт');
  assert.strictEqual((await mock('/_stats'))['1001'].webhookUrl, `${BASE}/webhook/whsecret`);
  ok('неверный токен отклонён, webhook установлен при добавлении');
  for (const inst of [A, B]) {
    assert.strictEqual((await get(`/api/instances/${inst.id}/qr`)).type, 'qrCode');
    assert.strictEqual((await get(`/api/instances/${inst.id}/qr`)).type, 'alreadyLogged');
  }
  const list0 = await until(async () => { const l = await instances(); return l.every((i) => i.state === 'authorized' && i.phone) && l; }, 'номера авторизованы');
  assert.strictEqual(list0[0].phone, '77001001');
  ok('QR авторизуется со второго запроса, phone подтянут');
  await call('PATCH', `/api/instances/${A.id}`, { daily_limit_start: 10, daily_limit_max: 10, warmup_step: 0 });
  await call('PATCH', `/api/instances/${B.id}`, { enabled: false, daily_limit_start: 50, daily_limit_max: 500, warmup_step: 30 }); // прежние значения по умолчанию, на них рассчитаны сценарии ниже

  const previewForm = new FormData();
  previewForm.append('file', new Blob([standardXlsx([['+7 701 123 45 67', 'Айгуль', 'Алматы']])]), 'contacts.xlsx');
  const checked = await call('POST', '/api/import-standard/preview', previewForm);
  assert.deepStrictEqual([checked.http, checked.recipients, checked.phone_column, checked.can_import], [200, 1, 'Телефон (колонка A)', true]);
  assert.strictEqual(checked.sample[0].phone, '77011234567');
  const wrongForm = new FormData();
  wrongForm.append('file', new Blob([standardXlsx([['+7 701 123 45 67', 'Айгуль', 'Алматы']])]), 'contacts.xlsx');
  wrongForm.append('hash', 'wrong');
  assert.strictEqual((await call('POST', '/api/import-standard', wrongForm)).http, 400);
  ok('единый шаблон: колонка A определена точно, проверка без сохранения, хеш обязателен');

  console.log('Импорт 92 000 строк');
  const xlsx = path.join(TMP, 'base-92k.xlsx');
  const expected = writeXlsx(xlsx, 92000);
  const form = () => { const f = new FormData(); f.append('file', new Blob([fs.readFileSync(xlsx)]), 'base-92k.xlsx'); return f; };
  const t0 = Date.now();
  const imp = await call('POST', '/api/import', form());
  const took = Date.now() - t0;
  assert.strictEqual(imp.status, 200, imp.error);
  assert.strictEqual(imp.rows, expected.rows);
  assert.strictEqual(imp.valid, expected.unique);
  assert.strictEqual(imp.new, expected.unique);
  assert.strictEqual(imp.duplicates, expected.duplicates);
  assert.strictEqual(imp.invalid, expected.invalid);
  assert.strictEqual(imp.phone_column, 'телефон');
  assert.ok(imp.invalid_examples.length > 0);
  assert.ok(took < 8000, `импорт слишком медленный: ${took} мс`);
  ok(`импорт за ${took} мс (на сервере ${imp.ms} мс): уникальных ${imp.valid}, дублей ${imp.duplicates}, невалидных ${imp.invalid}`);
  const again = await call('POST', '/api/import', form());
  assert.strictEqual(again.new, 0);
  assert.strictEqual(again.existing, expected.unique);
  assert.strictEqual((await get('/api/overview')).contacts, expected.unique);
  ok('повторный импорт не создаёт дублей (upsert по phone)');
  const prev = await post('/api/preview', { text: '{Здравствуйте|Добрый день}, {ФИО}! Город: {город}', list_id: imp.list_id });
  assert.strictEqual(prev._body.length, 3);
  assert.match(prev._body[0].text, /^(Здравствуйте|Добрый день), \S+ \d+! Город: \S+$/);
  ok('превью на 3 случайных контактах, переменные из колонок');

  console.log('CSV в Windows-1251');
  const phones = [];
  for (let i = 0; i < 40; i++) phones.push(`7701555${1000 + i}`); // окончания 00–39: есть 13, 21, 31
  phones.push('77015559977', '77015559955');
  const csv = 'Имя;Телефон;Город\r\n' + phones.map((p, i) => `Айгуль ${i};8${p.slice(1)};Алматы`).join('\r\n') + '\r\nБез номера;;Астана\r\n';
  const cp1251 = Buffer.from([...csv].map((ch) => {
    const c = ch.charCodeAt(0);
    if (c < 128) return c;
    if (c >= 0x410 && c <= 0x44f) return c - 0x350;
    throw new Error('char ' + ch);
  }));
  const f2 = new FormData();
  f2.append('file', new Blob([cp1251]), 'тест.csv');
  f2.append('name', 'Тестовая база');
  const small = await call('POST', '/api/import', f2);
  assert.strictEqual(small.status, 200, small.error);
  assert.deepStrictEqual([small.valid, small.new, small.invalid], [42, 42, 1]);
  const pv = await post('/api/preview', { text: '{name} из {город}', list_id: small.list_id });
  assert.match(pv._body[0].text, /^Айгуль \d+ из Алматы$/);
  ok('CSV cp1251 распознан, имена и колонки на месте');

  console.log('Кампании');
  const mk = (name, ids, extra = {}) => post('/api/campaigns', {
    name, text: '{Здравствуйте|Добрый день}, {name}!\n\nОтветьте СТОП, чтобы отписаться.', list_id: small.list_id,
    instance_ids: ids, delay_min: 0, delay_max: 0, hour_from: 0, hour_to: 24, ...extra,
  });
  const c1 = await mk('Кампания 1', [A.id]);
  const c2 = await mk('Кампания 2 (проверка WA)', [B.id], { check_wa: 1 });
  assert.strictEqual(c1.http, 200, c1.error);
  assert.strictEqual((await post(`/api/campaigns/${c1.id}/start`)).stats.total, 42);
  assert.strictEqual((await post(`/api/campaigns/${c2.id}/start`)).stats.total, 42);
  assert.strictEqual((await call('PUT', `/api/campaigns/${c1.id}`, { name: 'x' })).status, 400);
  ok('запуск из черновика, редактирование в running запрещено');

  // Дневной лимит: у A лимит 10
  await until(async () => (await instances())[0].sent_today >= 10, 'A отправил 10');
  await sleep(1500);
  const a1 = (await instances())[0];
  assert.strictEqual(a1.sent_today, 10, 'дневной лимит превышен');
  const s1 = (await campaign(c1.id));
  assert.strictEqual(s1.status, 'running');
  assert.strictEqual(s1.stats.sent, 10);
  assert.strictEqual(s1.stats.queue, 32);
  assert.ok(s1.stats.eta_days >= 3, 'ETA при лимите 10/день');
  assert.strictEqual((await mock('/_stats'))['1001'].sent, 10);
  ok(`дневной лимит соблюдён: 10 из 10, в очереди 32, ETA ${s1.stats.eta_days} дн.`);

  await call('PATCH', `/api/instances/${A.id}`, { daily_limit_start: 500, daily_limit_max: 500 });
  const done1 = await until(async () => { const c = await campaign(c1.id); return c.status === 'finished' && c; }, 'кампания 1 finished');
  await until(async () => (await campaign(c1.id)).stats.read === 40, 'все статусы read');
  const st1 = (await campaign(c1.id)).stats;
  assert.deepStrictEqual(
    { total: st1.total, sent: st1.sent, read: st1.read, failed: st1.failed, no_wa: st1.no_wa, replied: st1.replied, queue: st1.queue },
    { total: 42, sent: 40, read: 40, failed: 1, no_wa: 1, replied: 2, queue: 0 });
  const m1 = await messages(c1.id);
  const byEnd = (list, end) => list.find((m) => m.phone.endsWith(end));
  assert.strictEqual(byEnd(m1, '1013').status, 'no_wa');
  assert.strictEqual(byEnd(m1, '9977').status, 'failed');
  assert.strictEqual(byEnd(m1, '9955').status, 'read');
  assert.strictEqual(byEnd(m1, '1021').replied, 1);
  assert.match(byEnd(m1, '1000').text, /^(Здравствуйте|Добрый день), Айгуль 0!\n\nОтветьте СТОП/);
  assert.ok(done1.finished_at);
  ok('кампания дошла до finished: sent→delivered→read, noAccount→no_wa, 400→failed, 500→повтор');
  assert.strictEqual((await messages(c1.id, '&replied=1')).length, 2);
  assert.strictEqual((await messages(c1.id, '&status=failed')).length, 1);
  ok('фильтры сообщений по статусу и «ответил»');

  // СТОП
  const opt = await until(async () => { const r = await get('/api/optouts'); return r.total === 1 && r; }, 'стоп-лист');
  assert.ok(opt.rows[0].phone.endsWith('1031'));
  const m2 = await messages(c2.id);
  assert.strictEqual(byEnd(m2, '1031').status, 'skipped');
  assert.strictEqual(m2.filter((m) => m.status === 'pending').length, 41);
  const inc = await get('/api/incoming');
  assert.strictEqual(inc.total, 2);
  assert.ok(inc.rows.some((r) => r.is_stop === 1 && r.text === 'Стоп'));
  ok('«Стоп» → стоп-лист, pending этого номера → skipped, входящие сохранены');

  // Стоп-слово только как отдельное слово
  const hook = (body) => fetch(`${BASE}/webhook/whsecret`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const incoming = (phone, messageData) => hook({ typeWebhook: 'incomingMessageReceived', instanceData: { idInstance: 1001 }, senderData: { chatId: `${phone}@c.us`, senderName: 'T' }, messageData });
  await incoming('77015551001', { textMessageData: { textMessage: 'Остановка у стопки книг' } });
  await incoming('77015551002', { extendedTextMessageData: { text: 'пожалуйста, СТОП!' } });
  await incoming('120363000000000000@g.us'.replace('@g.us', ''), { textMessageData: { textMessage: 'ок' } });
  const bad = await fetch(`${BASE}/webhook/wrong`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"typeWebhook":"incomingMessageReceived","senderData":{"chatId":"77015551003@c.us"},"messageData":{"textMessageData":{"textMessage":"стоп"}}}' });
  assert.strictEqual(bad.status, 200);
  const opt2 = await get('/api/optouts');
  assert.deepStrictEqual(opt2.rows.map((r) => r.phone).sort(), ['77015551002', '77015551031']);
  ok('стоп-слово срабатывает только как отдельное слово; чужой secret игнорируется (200)');
  await call('DELETE', '/api/optouts/77015551002');
  assert.strictEqual((await get('/api/optouts')).total, 1);
  assert.strictEqual((await post('/api/optouts', { phones: '8 701 555 10 02' })).added, 1);
  await call('DELETE', '/api/optouts/77015551002');
  ok('ручное добавление и удаление из стоп-листа');

  // yellowCard
  await call('PATCH', `/api/instances/${B.id}`, { enabled: true });
  await until(async () => (await instances())[1].sent_today >= 3, 'B начал отправку');
  await mock('/_state', { idInstance: 1002, state: 'yellowCard' });
  const b1 = await until(async () => { const i = (await instances())[1]; return !i.enabled && i; }, 'B остановлен');
  assert.match(b1.disabled_reason, /yellowCard/);
  assert.strictEqual(b1.state, 'yellowCard');
  await sleep(700);
  const frozen = (await mock('/_stats'))['1002'].sent;
  await sleep(1200);
  assert.strictEqual((await mock('/_stats'))['1002'].sent, frozen, 'после yellowCard отправка должна прекратиться');
  assert.strictEqual((await campaign(c2.id)).status, 'running');
  const ev = await get('/api/events');
  assert.ok(ev.rows.some((e) => e.level === 'error' && /остановлен/.test(e.message)));
  ok(`yellowCard останавливает номер (отправлено ${frozen}, дальше тишина), запись в журнале`);

  // уведомления: ошибка попала в список и в счётчик, после просмотра счётчик гаснет
  const al = await get('/api/alerts');
  assert.ok(al.rows.some((r) => r.level === 'error' && r.is_new && /остановлен/.test(r.message) && r.instance_name));
  assert.ok(al.rows.every((r) => r.level === 'error' || r.level === 'warn'));
  assert.ok((await get('/api/overview')).alerts_unread >= 1);
  await post('/api/alerts/seen');
  assert.strictEqual((await get('/api/overview')).alerts_unread, 0);
  assert.ok((await get('/api/alerts')).rows.every((r) => !r.is_new));
  ok('уведомления: ошибки в списке и счётчике, после просмотра счётчик обнуляется');

  await mock('/_state', { idInstance: 1002, state: 'authorized' });
  await until(async () => (await instances())[1].state === 'authorized', 'B снова authorized');
  assert.strictEqual((await instances())[1].enabled, 0, 'сам не включается');
  await call('PATCH', `/api/instances/${B.id}`, { enabled: true });
  await until(async () => (await campaign(c2.id)).status === 'finished', 'кампания 2 finished');
  // отправка, летевшая в момент yellowCard, может получить 400 от mock → failed (1 или 2 ошибки)
  await until(async () => { const s = (await campaign(c2.id)).stats; return s.read + s.failed === 39 && s.failed <= 2; }, 'кампания 2: read', 15000);
  const st2 = (await campaign(c2.id)).stats;
  assert.deepStrictEqual({ no_wa: st2.no_wa, skipped: st2.skipped, done: st2.read + st2.failed, queue: st2.queue }, { no_wa: 1, skipped: 2, done: 39, queue: 0 }); // skipped: …1031 (Стоп) и …1002 (стоп-слово выше)
  ok('check_wa: номер без WhatsApp → no_wa без отправки; кампания 2 finished');

  // 401 → автостоп
  const c4 = await mk('Кампания 401', [B.id]);
  await mock('/_state', { idInstance: 1002, forceStatus: 401 });
  await post(`/api/campaigns/${c4.id}/start`);
  const b2 = await until(async () => { const i = (await instances())[1]; return !i.enabled && i; }, 'B остановлен по 401');
  assert.match(b2.disabled_reason, /401/);
  await mock('/_state', { idInstance: 1002, forceStatus: 466 });
  await call('PATCH', `/api/instances/${B.id}`, { enabled: true });
  const b3 = await until(async () => { const i = (await instances())[1]; return !i.enabled && i; }, 'B остановлен по 466');
  assert.match(b3.disabled_reason, /466/);
  await mock('/_state', { idInstance: 1002, forceStatus: 500 });
  await call('PATCH', `/api/instances/${B.id}`, { enabled: true });
  const b4 = await until(async () => { const i = (await instances())[1]; return !i.enabled && i; }, 'B остановлен по 5 ошибкам', 30000);
  assert.match(b4.disabled_reason, /5 ошибок подряд/);
  assert.strictEqual((await campaign(c4.id)).stats.queue, 41, 'сообщения должны вернуться в очередь');
  await mock('/_state', { idInstance: 1002, forceStatus: 0 });
  await post(`/api/campaigns/${c4.id}/pause`);
  assert.strictEqual((await post(`/api/campaigns/${c4.id}/resume`)).status, 'running');
  assert.strictEqual((await post(`/api/campaigns/${c4.id}/stop`)).status, 'stopped');
  ok('автостоп по 401, 466 и 5 ошибкам подряд; сообщения остаются в очереди; пауза/продолжить/стоп');

  // Повтор ошибок, exclude_recent_days, экспорт
  const retry = await post(`/api/campaigns/${c1.id}/retry`);
  assert.strictEqual(retry.status, 'running');
  await until(async () => (await campaign(c1.id)).status === 'finished', 'повтор ошибок завершён');
  assert.strictEqual((await campaign(c1.id)).stats.failed, 1);
  const c3 = await mk('Кампания 3', [A.id]);
  const started3 = await post(`/api/campaigns/${c3.id}/start`, { exclude_recent_days: 7 });
  assert.strictEqual(started3.stats.total, 2, 'остаться должны только те, кому не дошло (…13 и …77)');
  await until(async () => (await campaign(c3.id)).status === 'finished', 'кампания 3 finished');
  ok('повтор ошибок; exclude_recent_days исключает тех, кому успешно писали');
  const exp = await call('GET', `/api/campaigns/${c1.id}/export.csv`, undefined, true);
  const buf = Buffer.from(await exp.arrayBuffer());
  assert.deepStrictEqual([...buf.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const lines = buf.toString('utf8').trim().split('\r\n');
  assert.strictEqual(lines.length, 43);
  assert.ok(lines[0].includes('"Телефон";"Имя";"Статус"'));
  ok('экспорт CSV: UTF-8 с BOM, разделитель «;», 42 строки');

  // Медиа
  const mf = new FormData();
  mf.append('file', new Blob([Buffer.from('89504e470d0a1a0a', 'hex')]), 'картинка.png');
  const media = await call('POST', '/api/media', mf);
  assert.match(media.url, new RegExp(`^${BASE}/media/[\\w-]+\\.png$`));
  assert.strictEqual(media.name, 'картинка.png');
  assert.strictEqual((await fetch(media.url)).status, 200, 'медиа доступно без авторизации');
  const hf = new FormData();
  hf.append('file', new Blob(['<script>']), 'x.html');
  assert.strictEqual((await call('POST', '/api/media', hf)).status, 400);
  const c5 = await mk('Кампания с файлом', [A.id], { media_url: media.url, media_name: media.name });
  assert.strictEqual((await post(`/api/campaigns/${c5.id}/start`)).status, 'running');
  await until(async () => (await campaign(c5.id)).status === 'finished', 'кампания с файлом finished');
  ok('медиа: загрузка, публичная ссылка, отправка через sendFileByUrl');

  // Подключение одной кнопкой: свободный слот переиспользуется, управляемый инстанс удаляется и в GREEN-API
  await post(`/api/instances/${B.id}/logout`);
  const slot = await post('/api/numbers/connect');
  assert.deepStrictEqual([slot.id, slot.created], [B.id, false], 'должен вернуться свободный слот');
  assert.strictEqual((await get(`/api/instances/${B.id}/qr`)).type, 'qrCode');
  assert.strictEqual((await get(`/api/instances/${B.id}/qr`)).type, 'alreadyLogged');
  const made = await post('/api/numbers/connect');
  assert.strictEqual(made.created, true, made.error);
  assert.strictEqual(made.managed, 1);
  assert.ok((await mock('/_stats'))[made.id_instance].webhookUrl.endsWith('/webhook/whsecret'));
  assert.strictEqual((await call('DELETE', `/api/instances/${made.id}`)).warning, null);
  assert.strictEqual((await mock('/_stats'))[made.id_instance], undefined, 'инстанс должен быть удалён в GREEN-API');
  ok('«Подключить номер»: свободный слот, автосоздание через партнёрский API, удаление вместе с инстансом');

  // Google Таблицы и шаблоны
  const gs = await post('/api/import-url', { url: 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit#gid=0' });
  assert.strictEqual(gs.http, 200, gs.error);
  assert.deepStrictEqual([gs.list_name, gs.valid, gs.duplicates], ['Клиенты из Google', 2, 1]);
  const recipientsCsv = await call('GET', `/api/lists/${gs.list_id}/recipients.csv`, undefined, true);
  assert.strictEqual(recipientsCsv.status, 200);
  assert.match(await recipientsCsv.text(), /\+77018880001/);
  assert.strictEqual((await post('/api/import-url', { url: 'https://docs.google.com/spreadsheets/d/private-sheet-0000000000000000/edit' })).http, 400);
  assert.strictEqual((await post('/api/import-url', { url: 'http://169.254.169.254/latest' })).http, 400);
  ok('импорт по ссылке Google Таблицы; закрытая таблица и посторонние адреса отклоняются');
  const tpls = (await get('/api/templates'))._body;
  assert.ok(tpls.length >= 3, 'стартовые шаблоны');
  const tpl = await post('/api/templates', { name: 'Мой', text: 'Привет, {name}!' });
  assert.strictEqual((await call('PUT', `/api/templates/${tpl.id}`, { name: 'Мой 2', text: 'Здравствуйте, {name}!' })).name, 'Мой 2');
  assert.strictEqual((await call('DELETE', `/api/templates/${tpl.id}`)).http, 200);
  ok('шаблоны: стартовый набор, создание, изменение, удаление');

  // Удаление базы
  const del = await call('DELETE', `/api/lists/${again.list_id}`);
  assert.strictEqual(del.removed, 0, 'контакты остаются в первой базе');
  ok('удаление базы не трогает контакты из других баз');
}

async function restartTest(startServer) {
  console.log('Перезапуск сервера');
  children[1].kill('SIGTERM');
  await new Promise((r) => children[1].once('exit', r));
  const row = (await testPool.query("SELECT id FROM messages WHERE status = 'pending' LIMIT 1")).rows[0];
  await testPool.query("UPDATE messages SET status = 'sending' WHERE id = $1", [row.id]);
  children[1] = startServer();
  await waitHttp(`${BASE}/api/login`);
  await until(async () => (await testPool.query('SELECT status FROM messages WHERE id = $1', [row.id])).rows[0].status === 'pending', 'sending → pending');
  ok('при старте сервера «sending» возвращается в «pending»');
}

async function uiTests() {
  console.log('UI: быстрый запуск рассылки (Playwright)');
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const errors = [];
  const requests = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1380, height: 900 } });
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
    page.on('request', r => { if (r.url().includes('/api/')) requests.push(new URL(r.url()).pathname); });
    await page.goto(BASE + '/');
    await page.waitForSelector('#login:not([hidden])');
    await page.fill('#login-name', 'boss');
    await page.fill('#login-password', 'testpass');
    await page.click('#login-form button[type=submit]');
    await page.waitForSelector('tr:has-text("Кампания 1")');
    assert.strictEqual(await page.evaluate(() => location.hash), '#campaigns');

    // карточка рассылки
    await page.click('button.campaign-name:has-text("Кампания 1")');
    await page.waitForSelector('dialog .stat-grid');
    assert.ok(await page.locator('dialog [role=progressbar]').count());
    await page.click('dialog [data-act=close]');

    // номера: подключение по QR и подсказка «что дальше»
    await page.click('a[href="#numbers"]');
    await page.waitForSelector('.number-grid');
    await page.click('button.campaign-name:has-text("Номер A")');
    await page.waitForSelector('dialog .kv');
    await page.click('dialog [data-act=instance-refresh]');
    await page.click('dialog [data-act=close]');
    await page.click('[data-act=instance-new]'); // ручное добавление
    await page.fill('#i-name', 'Номер C');
    await page.fill('#i-id', '1003');
    await page.fill('#i-token', 'goodtoken');
    await page.fill('#i-url', MOCK);
    await page.click('button[form=instance-form]');
    await page.waitForSelector('#qr-box img');
    await page.waitForSelector('#qr-box:has-text("Подключено")', { timeout: 10000 });
    await page.waitForSelector('#qr-box [data-act=campaign-new]');
    await page.click('dialog [data-act=close]');
    await page.waitForSelector('.number-card:has-text("Номер C") .badge:has-text("Подключён")');
    // «Подключить номер» одной кнопкой: подключение создаётся само, остаётся только QR
    await page.click('.heading-actions [data-act=connect-number]');
    await page.waitForSelector('#qr-box .qr-steps');
    await page.waitForSelector('#qr-box:has-text("Подключено")', { timeout: 10000 });
    await page.click('dialog [data-act=close]');
    await page.waitForSelector('.number-card:has-text("Номер 4") .badge:has-text("Подключён")');
    // лимит номеров (MAX_NUMBERS=4) — понятное сообщение вместо ошибки
    await page.click('.heading-actions [data-act=connect-number]');
    await page.waitForSelector('dialog:has-text("максимальное число номеров")');
    await page.click('dialog [data-act=close]');

    // шаблон → новая рассылка → проверка и сохранение базы Excel прямо из формы
    await page.click('a[href="#templates"]');
    await page.waitForSelector('.tpl-card');
    await page.click('[data-act=template-new]');
    await page.fill('#t-name', 'UI-шаблон');
    await page.fill('#c-text', '{Привет|Здравствуйте}, {name}!');
    await page.click('[data-act=insert][data-text*="СТОП"]');
    await page.click('button[form=template-form]');
    await page.click('.tpl-card:has-text("UI-шаблон") [data-act=template-use]');
    await page.waitForSelector('#campaign-form');
    assert.ok((await page.inputValue('#c-text')).includes('Ответьте СТОП, чтобы отписаться'));
    await page.click('[data-act=form-import]');
    await page.setInputFiles('#import-file', { name: 'ui.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: standardXlsx([['+7 701 888 00 01', 'Дана', 'Астана'], ['8 701 888 00 02', 'Тимур', 'Алматы']]) });
    await page.fill('#import-name', 'UI база');
    await page.click('#import-submit');
    await page.waitForSelector('#import-result .kv');
    assert.match((await page.textContent('#import-result')).replace(/\s+/g, ' '), /Получателей рассылки2/);
    await page.click('#import-result [data-act=import-confirm]');
    await page.waitForSelector('#import-result [data-act=form-resume]');
    await page.click('#import-result [data-act=form-resume]');
    await page.waitForSelector('#campaign-form');
    assert.ok((await page.inputValue('#c-text')).includes('{name}'), 'текст сохранился после загрузки базы');
    assert.match(await page.locator('#c-list option:checked').textContent(), /UI база/);
    await page.click('[data-act=preview]');
    await page.waitForFunction(() => document.querySelectorAll('#preview .preview-email').length === 2);
    await page.click('button[form=campaign-form][value=launch]');
    await page.waitForSelector('dialog .stat-grid');
    await page.waitForSelector('dialog .badge:has-text("Отправляется"), dialog .badge:has-text("Завершена")');
    assert.strictEqual(await page.evaluate(() => location.hash), '#campaigns');
    await page.click('dialog [data-act=close]');
    await page.waitForSelector('tr:has-text("Рассылка ")');

    // база: импорт файла
    await page.click('a[href="#base"]');
    await page.waitForSelector('tr:has-text("UI база")');
    await page.click('.heading-actions [data-act=import]');
    await page.setInputFiles('#import-file', { name: 'ui.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: standardXlsx([['+77017770001', 'UI', ''], ['87017770001', 'Dup', ''], ['abc', 'Bad', '']]) });
    await page.click('#import-submit');
    await page.waitForSelector('#import-result .kv');
    assert.match((await page.textContent('#import-result')).replace(/\s+/g, ' '), /Дублей1.*Некорректных строк1/);
    assert.strictEqual(await page.locator('#import-result [data-act=import-confirm]').count(), 0);
    await page.setInputFiles('#import-file', { name: 'ui.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: standardXlsx([['+77017770001', 'UI', ''], ['87017770001', 'Dup', '']]) });
    await page.click('#import-submit');
    await page.waitForSelector('#import-result [data-act=import-confirm]');
    await page.click('#import-result [data-act=import-confirm]');
    await page.waitForSelector('#import-result [data-act=form-resume]');
    await page.click('dialog [data-act=close]');
    await page.waitForSelector('tr:has-text("ui")');

    await page.click('#navigation a[href="#alerts"]');
    await page.waitForSelector('.alerts-table tr:has-text("остановлен")');
    await page.waitForSelector('.problems .problem');
    await page.screenshot({ path: path.join(TMP, 'ui-alerts.png'), animations: 'disabled' });

    // мобильная ширина
    await page.setViewportSize({ width: 390, height: 844 });
    for (const hash of ['campaigns', 'numbers', 'base', 'templates']) {
      await page.click('#mobile-menu');
      await page.click(`#navigation a[href="#${hash}"]`);
      await page.waitForSelector(`#navigation a.active[href="#${hash}"]`);
      await page.waitForSelector('#mobile-menu[aria-expanded=false]');
      await page.waitForFunction(() => !document.querySelector('#main > .empty'));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `горизонтальная прокрутка: ${hash}`);
    }
    assert.strictEqual(await page.getAttribute('#mobile-menu', 'aria-expanded'), 'false');
    await page.evaluate(() => { location.hash = 'replies'; });
    await page.waitForFunction(() => location.hash === '#campaigns');
    await page.setViewportSize({ width: 1380, height: 900 });
    await page.screenshot({ path: path.join(TMP, 'ui.png'), animations: 'disabled' });
    await page.click('[data-act=campaign-new]');
    await page.waitForSelector('#campaign-form');
    await page.screenshot({ path: path.join(TMP, 'ui-form.png'), animations: 'disabled' });
    assert.deepStrictEqual(errors, []);
  } finally { await browser.close(); }
  ok(`шаблон → рассылка → проверка базы Excel → запуск; QR, импорт, мобильная навигация; ошибок нет (${TMP})`);
}

async function main() {
  if (!process.env.TEST_DATABASE_URL) throw new Error('Укажите TEST_DATABASE_URL для отдельной тестовой PostgreSQL базы');
  testSchema = `pulse_test_${Date.now()}`;
  const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  await admin.query(`CREATE SCHEMA ${testSchema}`);
  await admin.end();
  const url = new URL(process.env.TEST_DATABASE_URL);
  url.searchParams.set('options', `-csearch_path=${testSchema}`);
  process.env.DATABASE_URL = url.toString();
  testPool = new Pool({ connectionString: process.env.DATABASE_URL });
  unitTests();
  run('test/mock-green.js', { MOCK_PORT: String(MOCK_PORT) });
  const startServer = () => run('src/server.js', {
    PORT: String(PORT), DATA_DIR: TMP, ADMIN_LOGIN: 'boss', ADMIN_PASSWORD: 'testpass', PUBLIC_URL: BASE, WEBHOOK_SECRET: 'whsecret',
    SESSION_SECRET: 'test-session-secret', GSHEETS_EXPORT_BASE: MOCK, GREEN_PARTNER_TOKEN: 'partnertoken', GREEN_PARTNER_URL: MOCK, MAX_NUMBERS: '4', TZ_NAME: 'Asia/Almaty', MIN_DELAY_SEC: '0', TICK_MS: '40', RETRY_DELAY_SEC: '1', POLL_SEC: '60',
  });
  startServer();
  await waitHttp(`${MOCK}/_stats`);
  await waitHttp(`${BASE}/api/login`);
  await apiTests();
  await restartTest(startServer);
  if (process.env.SKIP_UI) console.log('UI пропущен (SKIP_UI)');
  else await uiTests();
  console.log(`\nВсе проверки пройдены: ${passed}`);
}

main()
  .catch((e) => { console.error('\n✗ ТЕСТ НЕ ПРОЙДЕН:', e.message, '\n', e.stack?.split('\n').slice(1, 4).join('\n')); process.exitCode = 1; })
  .finally(async () => {
    children.forEach((c) => c.kill('SIGTERM'));
    if (testPool) await testPool.end();
    if (testSchema) {
      const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
      try { await admin.query(`DROP SCHEMA ${testSchema} CASCADE`); } finally { await admin.end(); }
    }
    if (!process.env.KEEP_TMP) fs.rmSync(TMP, { recursive: true, force: true });
    setTimeout(() => process.exit(), 500);
  });
