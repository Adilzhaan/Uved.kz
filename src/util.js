'use strict';
const crypto = require('crypto');

const TZ = process.env.TZ_NAME || 'Asia/Almaty';

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' });

/** День в TZ_NAME в виде YYYY-MM-DD */
function dayInTz(ts = Date.now()) {
  return dayFmt.format(new Date(ts));
}
/** Час (0–23) в TZ_NAME */
function hourInTz(ts = Date.now()) {
  return Number(hourFmt.format(new Date(ts))) % 24;
}
/** Разница в днях между двумя YYYY-MM-DD */
function daysBetween(from, to) {
  const p = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((p(to) - p(from)) / 86400000);
}

/**
 * Нормализация телефона: только цифры; 8XXXXXXXXXX → 7XXXXXXXXXX;
 * 10 цифр на 7/9 → +7; 9 цифр → +998; допустимая длина 10–15.
 */
function normalizePhone(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') raw = Number.isFinite(raw) ? raw.toFixed(0) : '';
  let d = String(raw).replace(/\D/g, '');
  if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
  else if (d.length === 10 && (d[0] === '7' || d[0] === '9')) d = '7' + d;
  else if (d.length === 9) d = '998' + d;
  return d.length >= 10 && d.length <= 15 ? d : null;
}

const ENC = { '{': '', '}': '', '|': '' };
const DEC = { '': '{', '': '}', '': '|' };

/**
 * Шаблон: {переменная} (без учёта регистра, неизвестная → пусто) и спинтакс {a|b|c}
 * с вложенностью — на каждом шаге раскрывается самая внутренняя пара скобок.
 */
function renderTemplate(tpl, vars, rnd = Math.random) {
  const map = {};
  for (const [k, v] of Object.entries(vars || {})) map[String(k).trim().toLowerCase()] = v == null ? '' : String(v);
  let s = String(tpl || '');
  const re = /\{([^{}]*)\}/;
  let m;
  let guard = 0;
  while ((m = re.exec(s)) && guard++ < 5000) {
    const inner = m[1];
    let rep;
    if (inner.includes('|')) {
      const options = inner.split('|');
      rep = options[Math.floor(rnd() * options.length)];
    } else {
      // значения переменных экранируем, чтобы их содержимое не трактовалось как разметка
      rep = (map[inner.trim().toLowerCase()] ?? '').replace(/[{}|]/g, (c) => ENC[c]);
    }
    s = s.slice(0, m.index) + rep + s.slice(m.index + m[0].length);
  }
  return s
    .replace(/[-]/g, (c) => DEC[c])
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function hmac(secret, value) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function makeToken(secret, ttlMs) {
  const exp = String(Date.now() + ttlMs);
  return `${exp}.${hmac(secret, exp)}`;
}
function checkToken(secret, token) {
  if (typeof token !== 'string') return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  return safeEqual(sig, hmac(secret, exp)) && Number(exp) > Date.now();
}

/** Ячейка CSV (разделитель ;) с защитой от формул в Excel */
function csvCell(v) {
  let s = String(v ?? '');
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

module.exports = {
  TZ, dayInTz, hourInTz, daysBetween, normalizePhone, renderTemplate,
  hmac, safeEqual, makeToken, checkToken, csvCell, randInt,
};
