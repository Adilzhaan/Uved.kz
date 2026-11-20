'use strict';
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const MEDIA_DIR = path.join(DATA_DIR, 'media');
fs.mkdirSync(MEDIA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'app.db'));
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');

db.exec(`
CREATE TABLE IF NOT EXISTS instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  id_instance TEXT NOT NULL UNIQUE,
  api_token TEXT NOT NULL,
  api_url TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'unknown',
  phone TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  disabled_reason TEXT,
  daily_limit_start INTEGER NOT NULL DEFAULT 50,
  daily_limit_max INTEGER NOT NULL DEFAULT 500,
  warmup_step INTEGER NOT NULL DEFAULT 30,
  first_send_day TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  vars TEXT NOT NULL DEFAULT '{}',
  opted_out INTEGER NOT NULL DEFAULT 0,
  opted_out_at INTEGER
);
CREATE INDEX IF NOT EXISTS contacts_opted ON contacts(opted_out) WHERE opted_out = 1;
CREATE TABLE IF NOT EXISTS list_contacts (
  list_id INTEGER NOT NULL,
  contact_id INTEGER NOT NULL,
  PRIMARY KEY (list_id, contact_id)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS list_contacts_contact ON list_contacts(contact_id);
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  media_name TEXT,
  list_id INTEGER,
  instance_ids TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  delay_min INTEGER NOT NULL DEFAULT 25,
  delay_max INTEGER NOT NULL DEFAULT 70,
  hour_from INTEGER NOT NULL DEFAULT 10,
  hour_to INTEGER NOT NULL DEFAULT 20,
  check_wa INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  contact_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  instance_id INTEGER,
  id_message TEXT,
  text TEXT,
  error TEXT,
  replied INTEGER NOT NULL DEFAULT 0,
  sent_at INTEGER,
  UNIQUE (campaign_id, contact_id)
);
CREATE INDEX IF NOT EXISTS messages_queue ON messages(campaign_id, status, id);
CREATE INDEX IF NOT EXISTS messages_idmsg ON messages(id_message) WHERE id_message IS NOT NULL;
CREATE INDEX IF NOT EXISTS messages_phone ON messages(phone, sent_at);
CREATE INDEX IF NOT EXISTS messages_contact ON messages(contact_id, sent_at);
CREATE TABLE IF NOT EXISTS daily_counts (
  instance_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (instance_id, day)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS incoming (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id INTEGER,
  phone TEXT NOT NULL,
  name TEXT,
  text TEXT,
  is_stop INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  instance_id INTEGER,
  message TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) WITHOUT ROWID;
`);

// миграция: managed = 1 — подключение создано сервисом через партнёрский API GREEN-API
if (!db.prepare("SELECT 1 FROM pragma_table_info('instances') WHERE name = 'managed'").get()) {
  db.exec('ALTER TABLE instances ADD COLUMN managed INTEGER NOT NULL DEFAULT 0');
}

const DEFAULT_STOP_WORDS = 'стоп, stop, отписка, отписаться, отпишите, не пишите, unsubscribe';
db.prepare('INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)').run('stop_words', DEFAULT_STOP_WORDS);

// стартовые шаблоны — один раз, при первом запуске
if (!db.prepare("SELECT 1 FROM settings WHERE key = 'templates_seeded'").get()) {
  const STOP = '\n\nОтветьте СТОП, чтобы отписаться.';
  const seed = [
    ['Акция или спецпредложение', '{Здравствуйте|Добрый день}, {name}!\n\n{Хотим рассказать|Рады сообщить} о специальном предложении: [что предлагаете и до какого числа].\n\n{Интересно? Напишите «да» — расскажем подробнее|Ответьте на это сообщение, и мы всё расскажем}.' + STOP],
    ['Напоминание', '{Здравствуйте|Добрый день}, {name}!\n\nНапоминаем: [о чём напоминаете].\n\n{Если есть вопросы — просто ответьте на это сообщение|Будут вопросы — напишите нам сюда}.' + STOP],
    ['Возвращение клиента', '{Здравствуйте|Добрый день}, {name}!\n\n{Давно вас не видели|Вы давно у нас не были} — {хотим пригласить вас снова|будем рады видеть вас снова}. [Что нового или какой бонус].\n\n{Записать вас?|Подобрать удобное время?}' + STOP],
  ];
  const ins = db.prepare('INSERT INTO templates(name, text, created_at) VALUES (?, ?, ?)');
  db.transaction(() => {
    for (const [name, text] of seed) ins.run(name, text, Date.now());
    db.prepare("INSERT INTO settings(key, value) VALUES ('templates_seeded', '1')").run();
  })();
}

const insEvent = db.prepare('INSERT INTO events(ts, level, instance_id, message) VALUES (?, ?, ?, ?)');
/** Запись в журнал событий */
function logEvent(message, level = 'info', instanceId = null) {
  insEvent.run(Date.now(), level, instanceId, String(message).slice(0, 1000));
  if (level !== 'info') console.log(`[${level}] ${message}`);
}

function getSetting(key, fallback = '') {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return r ? r.value : fallback;
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));
}

module.exports = { db, DATA_DIR, MEDIA_DIR, logEvent, getSetting, setSetting };
