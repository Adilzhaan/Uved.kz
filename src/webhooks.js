'use strict';
const { db, logEvent, getSetting } = require('./db');
const worker = require('./worker');

const RANK = { sent: 1, delivered: 2, read: 3 };

async function instanceByWebhook(body) {
  const idInstance = body?.instanceData?.idInstance;
  if (idInstance == null) return null;
  return (await db.prepare('SELECT * FROM instances WHERE id_instance = ?').get(String(idInstance))) || null;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/** Стоп-слово как отдельное слово (границы — не буква и не цифра, Unicode) */
async function stopRegex() {
  const words = (await getSetting('stop_words')).split(/[,\n;]+/).map((w) => w.trim()).filter(Boolean);
  if (!words.length) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${words.map(escapeRe).join('|')})(?![\\p{L}\\p{N}])`, 'iu');
}

/** Добавить номер в стоп-лист; все его pending → skipped */
async function optOut(phone, source) {
  return await db.transaction(async () => {
    const now = Date.now();
    await db.prepare(`INSERT INTO contacts(phone, opted_out, opted_out_at) VALUES (?, 1, ?)
      ON CONFLICT(phone) DO UPDATE SET opted_out = 1, opted_out_at = COALESCE(contacts.opted_out_at, excluded.opted_out_at)`).run(phone, now);
    const r = await db.prepare("UPDATE messages SET status = 'skipped', error = 'контакт в стоп-листе' WHERE phone = ? AND status = 'pending'").run(phone);
    await logEvent(`${phone} добавлен в стоп-лист (${source}); снято из очереди: ${r.changes}`);
    return r.changes;
  })();
}

async function onOutgoingStatus(body) {
  const status = body.status;
  if (status === 'yellowCard') {
    const inst = await instanceByWebhook(body);
    if (inst) await worker.stopInstance(inst.id, 'Жёлтая карточка WhatsApp (yellowCard)');
  }
  const idMessage = body.idMessage;
  if (!idMessage) return;
  const msg = await db.prepare('SELECT id, status FROM messages WHERE id_message = ?').get(String(idMessage));
  if (!msg) return;
  if (RANK[status]) {
    // sent < delivered < read — статус только повышается
    if (RANK[msg.status] && RANK[status] > RANK[msg.status]) {
      await db.prepare('UPDATE messages SET status = ? WHERE id = ?').run(status, msg.id);
    }
  } else if (status === 'noAccount') {
    await db.prepare("UPDATE messages SET status = 'no_wa' WHERE id = ?").run(msg.id);
  } else if (status === 'failed' || status === 'yellowCard') {
    if (msg.status === 'sent') {
      await db.prepare("UPDATE messages SET status = 'failed', error = ? WHERE id = ?").
      run(String(body.description || status).slice(0, 500), msg.id);
    }
  }
}

function incomingText(md) {
  if (!md) return '';
  return (
    md.textMessageData?.textMessage ||
    md.extendedTextMessageData?.text ||
    md.fileMessageData?.caption ||
    md.imageMessageData?.caption ||
    md.videoMessageData?.caption ||
    md.documentMessageData?.caption ||
    '');

}

async function onIncoming(body) {
  const chatId = String(body?.senderData?.chatId || '');
  if (!chatId.endsWith('@c.us')) return; // группы и рассылки игнорируем
  const phone = chatId.replace(/\D/g, '');
  if (!phone) return;
  const text = String(incomingText(body.messageData) || '').slice(0, 4000);
  const inst = await instanceByWebhook(body);
  const re = await stopRegex();
  const isStop = !!(re && text && re.test(text));
  await db.prepare('INSERT INTO incoming(instance_id, phone, name, text, is_stop, created_at) VALUES (?, ?, ?, ?, ?, ?)').
  run(inst?.id ?? null, phone, String(body.senderData.senderName || body.senderData.chatName || '').slice(0, 200), text, isStop ? 1 : 0, Date.now());
  await db.prepare(`UPDATE messages SET replied = 1 WHERE id = (
    SELECT id FROM messages WHERE phone = ? AND sent_at IS NOT NULL ORDER BY sent_at DESC, id DESC LIMIT 1)`).run(phone);
  if (isStop) await optOut(phone, 'ответ со стоп-словом');
}

async function onStateChanged(body) {
  const inst = await instanceByWebhook(body);
  const state = body.stateInstance;
  if (!inst || !state) return;
  await worker.applyState(inst.id, String(state), state === 'notAuthorized' ? null : undefined);
}

function handleWebhook(body) {
  if (!body || typeof body !== 'object') return;
  switch (body.typeWebhook) {
    case 'outgoingMessageStatus':return onOutgoingStatus(body);
    case 'incomingMessageReceived':return onIncoming(body);
    case 'stateInstanceChanged':return onStateChanged(body);
    default:
  }
}

module.exports = { handleWebhook, optOut, stopRegex };
