'use strict';
const XLSX = require('xlsx');
const { db } = require('./db');
const { normalizePhone } = require('./util');

const PHONE_HEADER = /phone|тел|номер|whatsapp|моб/i;
const NAME_HEADER = /^(name|имя|фио|ф\.и\.о\.?|клиент|пациент|контакт|наименование|название)/i;

/** CSV: сначала строгий UTF-8, при ошибке — Windows-1251 */
function decodeText(buf) {
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder('windows-1251').decode(buf);
  }
  return text.replace(/^﻿/, '');
}

function parseCsv(text) {
  const first = text.slice(0, text.indexOf('\n') < 0 ? text.length : text.indexOf('\n'));
  const count = (ch) => first.split(ch).length - 1;
  const delimiter = [';', '\t', ','].sort((a, b) => count(b) - count(a))[0];
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === delimiter) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function readRows(buffer, filename) {
  if (/\.(csv|txt|tsv)$/i.test(filename || '')) return parseCsv(decodeText(buffer));
  const wb = XLSX.read(buffer, { type: 'buffer', dense: true, cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: false });
}

function cellText(v) {
  if (v == null) return '';
  if (v instanceof Date) return v.toLocaleDateString('ru-RU');
  if (typeof v === 'number') return Number.isInteger(v) ? v.toFixed(0) : String(v);
  return String(v).trim();
}

const isMobileLike = (p) => /^(7\d{10}|998\d{9})$/.test(p);

/** Разбор файла: определение заголовка, колонки телефона, нормализация, дедупликация */
function parseFile(buffer, filename) {
  const rows = readRows(buffer, filename).filter((r) => r && r.some((c) => c !== '' && c != null));
  if (!rows.length) throw Object.assign(new Error('Файл пустой или не распознан'), { status: 400 });

  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  // Заголовок есть, если в первой строке нет ни одного валидного номера
  const hasHeader = !rows[0].some((c) => normalizePhone(c));
  const headers = [];
  for (let i = 0; i < width; i++) {
    const h = hasHeader ? cellText(rows[0][i]).toLowerCase() : '';
    headers.push(h || `col${i + 1}`);
  }
  const data = hasHeader ? rows.slice(1) : rows;

  // Колонка телефона: по заголовку, иначе та, где больше всего валидных номеров
  const sample = data.slice(0, 300);
  const score = (col) => sample.reduce((n, r) => {
    const p = normalizePhone(r[col]);
    return n + (p ? 1 : 0) + (p && isMobileLike(p) ? 1 : 0);
  }, 0);
  let phoneCol = hasHeader ? headers.findIndex((h) => PHONE_HEADER.test(h)) : -1;
  if (phoneCol >= 0 && sample.length && score(phoneCol) < sample.length * 0.5) phoneCol = -1; // «номер договора» и т.п.
  if (phoneCol < 0) {
    let best = 0;
    for (let i = 0; i < width; i++) {
      const s = score(i);
      if (s > best) { best = s; phoneCol = i; }
    }
  }
  if (phoneCol < 0) throw Object.assign(new Error('Не найдена колонка с телефонами'), { status: 400 });
  const nameCol = hasHeader ? headers.findIndex((h, i) => i !== phoneCol && NAME_HEADER.test(h)) : -1;

  const seen = new Set();
  const contacts = [];
  const invalidExamples = [];
  let invalid = 0;
  let duplicates = 0;
  for (const r of data) {
    const phone = normalizePhone(r[phoneCol]);
    if (!phone) {
      invalid++;
      if (invalidExamples.length < 10) invalidExamples.push(cellText(r[phoneCol]).slice(0, 40));
      continue;
    }
    if (seen.has(phone)) { duplicates++; continue; }
    seen.add(phone);
    const vars = {};
    for (let i = 0; i < width; i++) {
      if (i === phoneCol) continue;
      const v = cellText(r[i]);
      if (v !== '') vars[headers[i]] = v;
    }
    contacts.push({ phone, name: nameCol >= 0 ? cellText(r[nameCol]) : '', vars: JSON.stringify(vars) });
  }
  return {
    contacts, rows: data.length, invalid, invalidExamples, duplicates,
    phoneColumn: headers[phoneCol], nameColumn: nameCol >= 0 ? headers[nameCol] : null, hasHeader,
  };
}

/** Единый шаблон для загрузки: один лист «Контакты», колонки строго A–C. */
function parseStandardFile(buffer, filename) {
  if (!/\.xlsx$/i.test(filename || ''))
    throw Object.assign(new Error('Загрузите файл Excel .xlsx по шаблону'), { status: 400 });
  let wb;
  try { wb = XLSX.read(buffer, { type: 'buffer', dense: true, cellDates: true }); }
  catch { throw Object.assign(new Error('Не удалось открыть Excel-файл. Скачайте шаблон и сохраните его как .xlsx'), { status: 400 }); }
  if (wb.SheetNames.length !== 1 || wb.SheetNames[0] !== 'Контакты')
    throw Object.assign(new Error('В файле должен быть один лист с названием «Контакты»'), { status: 400 });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Контакты'], { header: 1, raw: true, defval: '', blankrows: false });
  const headers = (rows[0] || []).map(cellText);
  if (headers.length !== 3 || headers[0] !== 'Телефон' || headers[1] !== 'Имя' || headers[2] !== 'Город')
    throw Object.assign(new Error('Первая строка должна содержать ровно три колонки: Телефон, Имя, Город — в этом порядке'), { status: 400 });
  if (rows.slice(1).some((row) => row.slice(3).some((cell) => cellText(cell) !== '')))
    throw Object.assign(new Error('В шаблоне предусмотрены только три колонки: Телефон, Имя, Город'), { status: 400 });
  return parseFile(buffer, filename);
}

/** Импорт в базу: upsert по phone, vars — через json_patch, всё в одной транзакции */
function importFile(buffer, filename, listName, parser = parseFile) {
  const t0 = Date.now();
  const parsed = parser(buffer, filename);
  if (!parsed.contacts.length) {
    throw Object.assign(new Error(`В файле нет валидных номеров (строк: ${parsed.rows})`), { status: 400 });
  }
  const upsert = db.prepare(`
    INSERT INTO contacts(phone, name, vars) VALUES (@phone, @name, @vars)
    ON CONFLICT(phone) DO UPDATE SET
      name = CASE WHEN excluded.name <> '' THEN excluded.name ELSE contacts.name END,
      vars = json_patch(contacts.vars, excluded.vars)
    RETURNING id`);
  const link = db.prepare('INSERT OR IGNORE INTO list_contacts(list_id, contact_id) VALUES (?, ?)');
  const countAll = db.prepare('SELECT COUNT(*) n FROM contacts');

  const result = db.transaction(() => {
    const before = countAll.get().n;
    const listId = db.prepare('INSERT INTO lists(name, created_at) VALUES (?, ?)').run(listName, Date.now()).lastInsertRowid;
    for (const c of parsed.contacts) link.run(listId, upsert.get(c).id);
    const added = countAll.get().n - before;
    const optedOut = db.prepare(`SELECT COUNT(*) n FROM list_contacts lc JOIN contacts c ON c.id = lc.contact_id
      WHERE lc.list_id = ? AND c.opted_out = 1`).get(listId).n;
    return { listId: Number(listId), added, optedOut };
  })();

  return {
    list_id: result.listId,
    list_name: listName,
    rows: parsed.rows,
    valid: parsed.contacts.length,
    new: result.added,
    existing: parsed.contacts.length - result.added,
    duplicates: parsed.duplicates,
    invalid: parsed.invalid,
    invalid_examples: parsed.invalidExamples,
    opted_out: result.optedOut,
    phone_column: parsed.phoneColumn,
    name_column: parsed.nameColumn,
    ms: Date.now() - t0,
  };
}

module.exports = { importFile, parseFile, parseStandardFile, decodeText, parseCsv };
