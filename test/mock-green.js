'use strict';
// Фейковый GREEN-API для локальных тестов. По умолчанию слушает :4000.
//   token goodtoken, иначе 401
//   QR авторизуется со второго запроса
//   setSettings запоминает webhookUrl
//   send* присылает вебхуки sent → delivered → read
//   номера на 13 → noAccount, на 77 → 400, на 55 → иногда 500 (первая попытка)
//   номер на 21 отвечает, номер на 31 пишет «Стоп»
//   POST /_state {idInstance, state} меняет state (и шлёт stateInstanceChanged)
//   GET /_stats — счётчики для проверок
const http = require('http');

const PORT = Number(process.env.MOCK_PORT || 4000);
const SPEED = Number(process.env.MOCK_SPEED || 1); // множитель задержек вебхуков
const QR_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const instances = new Map(); // idInstance → { state, webhookUrl, qrRequests, sent, tried }
const inst = (id) => {
  if (!instances.has(id)) instances.set(id, { state: 'notAuthorized', webhookUrl: '', qrRequests: 0, sent: 0, tried: new Set() });
  return instances.get(id);
};
let seq = 0;
let partnerSeq = 0;

function hook(id, payload, delay) {
  const i = inst(id);
  setTimeout(() => {
    if (!i.webhookUrl) return;
    fetch(i.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceData: { idInstance: Number(id), wid: `7700${id}@c.us`, typeInstance: 'whatsapp' }, timestamp: Math.floor(Date.now() / 1000), ...payload }),
    }).catch(() => {});
  }, delay * SPEED);
}

function send(id, body) {
  const i = inst(id);
  const chatId = String(body.chatId || '');
  const phone = chatId.replace(/\D/g, '');
  if (!chatId.endsWith('@c.us') || !phone) return [400, { message: 'bad chatId' }];
  if (i.state !== 'authorized') return [466 === i.forceStatus ? 466 : 400, { message: 'instance not authorized' }];
  if (i.forceStatus) return [i.forceStatus, { message: 'forced' }];
  if (phone.endsWith('77')) return [400, { message: 'Validation failed' }];
  if (phone.endsWith('55') && !i.tried.has(phone)) { i.tried.add(phone); return [500, { message: 'Internal error' }]; }
  const idMessage = `MOCK${Date.now().toString(36).toUpperCase()}${++seq}`;
  i.sent++;
  const status = (s, d) => hook(id, { typeWebhook: 'outgoingMessageStatus', chatId, idMessage, status: s, sendByApi: true }, d);
  if (phone.endsWith('13')) status('noAccount', 60);
  else { status('sent', 40); status('delivered', 120); status('read', 220); }
  const reply = (text) => hook(id, {
    typeWebhook: 'incomingMessageReceived',
    idMessage: `IN${++seq}`,
    senderData: { chatId, sender: chatId, chatName: 'Клиент', senderName: 'Клиент' },
    messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: text } },
  }, 300);
  if (phone.endsWith('21')) reply('Здравствуйте! Да, интересно, расскажите подробнее');
  if (phone.endsWith('31')) reply('Стоп');
  return [200, { idMessage }];
}

const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { /* пусто */ }
    const out = (code, json) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(json)); };
    const url = new URL(req.url, 'http://x');

    if (url.pathname === '/_state' && req.method === 'POST') {
      const id = String(body.idInstance);
      const i = inst(id);
      if (body.state) {
        i.state = body.state;
        hook(id, { typeWebhook: 'stateInstanceChanged', stateInstance: i.state }, 10);
      }
      if ('forceStatus' in body) i.forceStatus = body.forceStatus || 0;
      return out(200, { ok: true, state: i.state });
    }
    if (url.pathname === '/_stats') {
      return out(200, Object.fromEntries([...instances].map(([k, v]) => [k, { state: v.state, webhookUrl: v.webhookUrl, sent: v.sent }])));
    }

    // фейковый экспорт Google Таблиц: id на «private» — закрытая таблица
    const g = url.pathname.match(/^\/spreadsheets\/d\/([\w-]+)\/export$/);
    if (g) {
      if (g[1].includes('private')) { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<html>Sign in</html>'); }
      res.writeHead(200, { 'Content-Type': 'text/csv', 'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent('Клиенты из Google.csv') });
      return res.end('Имя,Телефон,Город\nДана,+7 701 888 00 01,Астана\nТимур,8 701 888 00 02,Алматы\nТимур,87018880002,Алматы\n');
    }
    // партнёрский API
    const pm = url.pathname.match(/^\/partner\/(\w+)\/([^/]+)$/);
    if (pm) {
      if (pm[2] !== 'partnertoken') return out(401, { message: 'Unauthorized' });
      if (pm[1] === 'createInstance') {
        const id = String(2000 + (partnerSeq += 1));
        inst(id).webhookUrl = body.webhookUrl || '';
        return out(200, { idInstance: Number(id), apiTokenInstance: 'goodtoken', typeInstance: 'whatsapp' });
      }
      if (pm[1] === 'deleteInstanceAccount') { instances.delete(String(body.idInstance)); return out(200, { deleteInstanceAccount: true }); }
      return out(404, { message: 'unknown method' });
    }
    const m = url.pathname.match(/^\/waInstance(\d+)\/(\w+)\/([^/]+)$/);
    if (!m) return out(404, { message: 'not found' });
    const [, id, method, token] = m;
    if (token !== 'goodtoken') return out(401, { message: 'Unauthorized' });
    const i = inst(id);
    switch (method) {
      case 'getStateInstance': return out(200, { stateInstance: i.state });
      case 'qr':
        if (i.state === 'authorized') return out(200, { type: 'alreadyLogged', message: 'instance account already authorized' });
        if (++i.qrRequests >= 2) {
          i.state = 'authorized';
          hook(id, { typeWebhook: 'stateInstanceChanged', stateInstance: 'authorized' }, 10);
          return out(200, { type: 'alreadyLogged', message: 'instance account already authorized' });
        }
        return out(200, { type: 'qrCode', message: QR_PNG });
      case 'logout': i.state = 'notAuthorized'; i.qrRequests = 0; return out(200, { isLogout: true });
      case 'getWaSettings': return out(200, { wid: `7700${id}@c.us`, phone: `7700${id}`, stateInstance: i.state });
      case 'setSettings': if (body.webhookUrl !== undefined) i.webhookUrl = body.webhookUrl; return out(200, { saveSettings: true });
      case 'checkWhatsapp': return out(200, { existsWhatsapp: !String(body.phoneNumber).endsWith('13') });
      case 'sendMessage':
      case 'sendFileByUrl': return out(...send(id, body));
      default: return out(404, { message: 'unknown method' });
    }
  });
});
server.listen(PORT, () => console.log(`mock GREEN-API: http://localhost:${PORT} (token: goodtoken)`));
