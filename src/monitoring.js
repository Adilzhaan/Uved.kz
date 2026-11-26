'use strict';
// Мониторинг ошибок через Sentry. Без SENTRY_DSN модуль ничего не отправляет.
// Подключается первой строкой server.js, чтобы Sentry успел обернуть express и pg.

const DSN = process.env.SENTRY_DSN || '';
const THROTTLE_MS = 60 * 1000; // одна и та же ошибка — не чаще раза в минуту (воркер тикает каждую секунду)

// Токены GREEN-API и секрет вебхука лежат прямо в URL, а телефоны — в текстах ошибок.
// Всё это вычищаем до отправки в Sentry.
const SECRET_PATTERNS = [
  [/(\/waInstance\d+\/[A-Za-z]+\/)[^/?#\s"'\\]+/g, '$1[token]'],
  [/(\/partner\/[A-Za-z]+\/)[^/?#\s"'\\]+/g, '$1[token]'],
  [/(\/webhook\/)[^/?#\s"'\\]+/g, '$1[secret]'],
  [/(?<!\d|waInstance)(\d{3})\d{5,10}(\d{2})(?!\d)/g, '$1*****$2'] // телефоны: 77011234567 → 770*****67 (id инстанса не трогаем)
];

function scrubString(s) {
  let out = s;
  for (const [re, to] of SECRET_PATTERNS) out = out.replace(re, to);
  return out;
}
/** Чистит только строки, числа (таймстемпы, id) не трогает. Объект события меняется на месте. */
function scrub(value, seen = new WeakSet(), depth = 0) {
  if (typeof value === 'string') return scrubString(value);
  if (!value || typeof value !== 'object' || depth > 12 || seen.has(value)) return value;
  seen.add(value);
  for (const k of Object.keys(value)) value[k] = scrub(value[k], seen, depth + 1);
  return value;
}

let Sentry = null;
if (DSN) {
  Sentry = require('@sentry/node');
  Sentry.init({
    dsn: DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_NAME || process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || process.env.RAILWAY_GIT_COMMIT_SHA || undefined,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    sendDefaultPii: false,
    integrations: [
      // тело запроса (номера, тексты сообщений, пароль входа) и cookie сессии в Sentry не уходят
      Sentry.requestDataIntegration({ include: { data: false, cookies: false } })
    ],
    beforeSend: (event) => scrub(event),
    beforeSendTransaction: (event) => scrub(event),
    beforeBreadcrumb: (crumb) => scrub(crumb)
  });
}

const lastSent = new Map();
function throttled(key) {
  const now = Date.now();
  if (now - (lastSent.get(key) || 0) < THROTTLE_MS) return true;
  lastSent.set(key, now);
  if (lastSent.size > 500) lastSent.clear();
  return false;
}

/**
 * Неожиданная ошибка (баг, падение БД и т.п.).
 * area — где случилось (worker, webhook, api…), extra — id сущностей без персональных данных.
 */
function captureError(err, area, extra) {
  if (!Sentry) return;
  const key = `${area}:${err?.name}:${String(err?.message || err).slice(0, 200)}`;
  if (throttled(key)) return;
  Sentry.withScope((scope) => {
    scope.setTag('area', area);
    if (extra) scope.setContext('details', extra);
    Sentry.captureException(err);
  });
}

/** Важное событие без исключения: например, номер остановлен автостопом и рассылка встала */
function captureEvent(message, level, area, extra) {
  if (!Sentry) return;
  if (throttled(`${area}:${message}`)) return;
  Sentry.withScope((scope) => {
    scope.setTag('area', area);
    scope.setLevel(level);
    if (extra) scope.setContext('details', extra);
    Sentry.captureMessage(message);
  });
}

/** Дождаться отправки очереди событий перед выходом процесса */
async function flush(ms = 2000) {
  if (Sentry) await Sentry.flush(ms).catch(() => {});
}

module.exports = { enabled: !!Sentry, captureError, captureEvent, flush, scrub };
