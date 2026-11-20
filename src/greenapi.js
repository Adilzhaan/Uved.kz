'use strict';
// Клиент GREEN-API. Формат: {apiUrl}/waInstance{idInstance}/{method}/{apiTokenInstance}

const TIMEOUT_MS = Number(process.env.GREEN_TIMEOUT_MS || 30000);

class GreenApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'GreenApiError';
    this.status = status; // HTTP-статус; undefined — сетевая ошибка/таймаут
    this.body = body;
  }
}

function client(inst) {
  const base = String(inst.api_url || 'https://api.green-api.com').replace(/\/+$/, '');
  const url = (method) => `${base}/waInstance${inst.id_instance}/${method}/${inst.api_token}`;

  async function call(method, payload) {
    let res;
    try {
      res = await fetch(url(method), {
        method: payload === undefined ? 'GET' : 'POST',
        headers: payload === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: payload === undefined ? undefined : JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      throw new GreenApiError(`${method}: сеть недоступна (${e.cause?.code || e.name || e.message})`);
    }
    const raw = await res.text();
    let body = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
    if (!res.ok) {
      const detail = body && typeof body === 'object' ? body.message || body.error || JSON.stringify(body) : String(raw || '').slice(0, 200);
      throw new GreenApiError(`${method}: HTTP ${res.status}${detail ? ' — ' + detail : ''}`, res.status, body);
    }
    return body;
  }

  const chatId = (phone) => `${phone}@c.us`;

  return {
    getStateInstance: () => call('getStateInstance'),
    qr: () => call('qr'),
    logout: () => call('logout'),
    getWaSettings: () => call('getWaSettings'),
    setSettings: (settings) => call('setSettings', settings),
    checkWhatsapp: (phone) => call('checkWhatsapp', { phoneNumber: Number(phone) }),
    sendMessage: (phone, message) => call('sendMessage', { chatId: chatId(phone), message }),
    sendFileByUrl: (phone, urlFile, fileName, caption) =>
      call('sendFileByUrl', { chatId: chatId(phone), urlFile, fileName, caption }),
  };
}

module.exports = { client, GreenApiError };
