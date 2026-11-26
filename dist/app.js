"use strict";
const paths = {
  send: "m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  mail: "M3 5h18v14H3z m0 1 9 7 9-7",
  check: "m5 12 4 4L19 6",
  checkCircle: "M22 11.1V12a10 10 0 1 1-5.9-9.14 M22 4 12 14l-3-3",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  chevrons: "m9 8 3-3 3 3 m-6 8 3 3 3-3",
  left: "m14 6-6 6 6 6",
  right: "m10 6 6 6-6 6",
  zap: "m13 2-9 12h7l-1 8 10-12h-7l1-8Z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
  help: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4 M12 17h.01",
  plus: "M12 5v14 M5 12h14",
  download: "M12 3v12 m-5-5 5 5 5-5 M5 16v5h14v-5",
  upload: "M12 16V3 m-5 5 5-5 5 5 M4 16v5h16v-5",
  search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  more: "M5 12h.01 M12 12h.01 M19 12h.01",
  shield: "M12 2 3 6v6c0 6 9 10 9 10s9-4 9-10V6L12 2Z m-4 10 3 3 5-6",
  menu: "M3 6h18 M3 12h18 M3 18h18",
  close: "m6 6 12 12 M6 18 18 6",
  clock: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 6v6l4 2",
  pause: "M8 5v14 M16 5v14",
  play: "m7 4 14 8-14 8V4Z",
  stop: "M6 6h12v12H6z",
  copy: "M9 9h12v12H9z M5 15H3V3h12v2",
  file: "M14 2H4v20h16V8l-6-6Z M14 2v6h6 M8 13h8 M8 17h6",
  logout: "M9 3H3v18h6 M10 12h12 m-5-5 5 5-5 5",
  phone:
    "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z",
  database:
    "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Z M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6",
  message: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z",
  list: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  trash: "M3 6h18 M8 6V4h8v2 M6 6l1 15h10l1-15",
  refresh: "M21 12a9 9 0 1 1-3-6.7L21 8 M21 3v5h-5",
  qr: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h3v3h-3z M20 14v.01 M14 20v.01 M20 20v.01 M17 17h4",
  edit: "M4 20h4L19 9l-4-4L4 16v4Z M13 7l4 4",
};
const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.mail}"/></svg>`;
document
  .querySelectorAll("[data-icon]")
  .forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const num = (n) => Number(n || 0).toLocaleString("ru-RU");
let tz = "Asia/Almaty";
const dateTime = (ts) =>
  ts
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: tz,
      }).format(new Date(ts))
    : "—";
const phoneFmt = (p) => (p ? "+" + esc(p) : "—");

/* ───────── API ───────── */
let me = null;
async function api(path, options = {}) {
  const init = { method: options.method || "GET", headers: {} };
  if (options.form) init.body = options.form;
  else if (options.body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  if (init.method === "GET" && !options.method && init.body)
    init.method = "POST";
  const res = await fetch("/api" + path, init);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/login") {
    showLogin();
    throw new Error("Требуется вход");
  }
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
  return data;
}
const post = (path, body = {}) => api(path, { method: "POST", body });

const navigation = [
  ["campaigns", "send", "Рассылки"],
  ["numbers", "phone", "WhatsApp-номера"],
  ["base", "database", "База для рассылки"],
  ["templates", "copy", "Шаблоны"],
];
const data = {
  campaigns: [],
  instances: [],
  lists: [],
  templates: [],
  overview: {},
};
let page = "campaigns",
  formDraft = null, // значения формы рассылки, пока пользователь загружает базу
  importPreview = null,
  importPreviewGeneration = 0,
  dialogState = null,
  qrTimer = null,
  loaded = false;
const instanceStates = {
  authorized: ["Подключён", "done"],
  notAuthorized: ["Не подключён", "paused"],
  blocked: ["Заблокирован", "failed"],
  yellowCard: ["Жёлтая карточка", "failed"],
  starting: ["Запускается", "scheduled"],
  sleepMode: ["Спящий режим", "paused"],
  unknown: ["Неизвестно", ""],
};
const campaignStatuses = {
  draft: ["Черновик", ""],
  running: ["Отправляется", "running"],
  paused: ["На паузе", "paused"],
  finished: ["Завершена", "done"],
  stopped: ["Остановлена", "stopped"],
};
const badge = (map, key) => {
  const s = map[key] || [key || "—", ""];
  return `<span class="badge ${s[1]}"><i></i>${esc(s[0])}</span>`;
};

let toastTimer;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 4200);
}
const fail = (e) => toast(e.message || "Что-то пошло не так");

function button(text, ic, act, cls = "", attrs = "") {
  return `<button type="button" class="button ${cls}" data-act="${act}" ${attrs}>${ic ? icon(ic) : ""}${text}</button>`;
}
function heading(title, subtitle, actions = "", eyebrow = "") {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div><div class="heading-actions">${actions}</div></div>`;
}

const empty = (ic, title, text) =>
  `<div class="empty">${icon(ic)}${title}<p>${text}</p></div>`;
/* ───────── Рассылки ───────── */
const isReady = (i) => i.enabled && i.state === "authorized";
function stepsBlock() {
  const o = data.overview;
  const steps = [
    [
      o.instances_active > 0,
      "phone",
      "Подключите номер",
      "Отсканируйте QR-код в WhatsApp на телефоне — так же, как при входе в WhatsApp Web.",
      "Подключить номер",
      "connect-number",
    ],
    [
      o.contacts > 0,
      "database",
      "Загрузите базу",
      "Файл Excel по шаблону или ссылка на Google Таблицу.",
      "Загрузить базу",
      "import",
    ],
    [
      o.campaigns_started > 0,
      "send",
      "Запустите рассылку",
      "Выберите готовый шаблон или напишите свой текст и нажмите «Запустить».",
      "Новая рассылка",
      "campaign-new",
    ],
  ];
  if (steps.every((x) => x[0])) return "";
  const next = steps.findIndex((x) => !x[0]);
  return `<section class="steps" aria-label="Быстрый старт">${steps
    .map(
      ([done, ic, title, text, label, act], i) =>
        `<article class="panel step ${done ? "done" : i === next ? "next" : ""}"><div class="step-top"><span class="mail-tile">${icon(done ? "check" : ic)}</span><span class="step-no">Шаг ${i + 1} из 3</span></div><h3>${title}</h3><p>${text}</p>${done ? '<span class="badge done"><i></i>Готово</span>' : button(label, null, act, i === next ? "primary" : "")}</article>`,
    )
    .join("")}</section>`;
}
const listName = (c) =>
  c.list_id === null
    ? "Все контакты"
    : data.lists.find((l) => l.id === c.list_id)?.name || "База удалена";
const donePercent = (st) =>
  st.total ? Math.floor(((st.total - st.queue) / st.total) * 100) : 0;
function campaignsPage() {
  const rows = data.campaigns;
  return (
    heading(
      "Рассылки",
      "Подключите номер, загрузите базу и запустите — остальное система сделает сама.",
      button("Написать сообщение", "message", "manual-message") +
        button("Новая рассылка", "plus", "campaign-new", "primary"),
    ) +
    stepsBlock() +
    `<section class="panel"><div class="panel-heading simple-panel-heading"><h2>Мои рассылки <span class="section-count">${rows.length}</span></h2><span class="section-caption">Сегодня отправлено: ${num(data.overview.sent_today)}</span></div>${
      rows.length
        ? `<div class="table-scroll"><table class="connection-table"><thead><tr><th>Название</th><th>Статус</th><th>Отправлено</th><th>Ответили</th><th><span class="sr-only">Действия</span></th></tr></thead><tbody>${rows
            .map((c) => {
              const st = c.stats;
              return `<tr><td><button class="campaign-name" data-act="campaign-open" data-id="${c.id}"><span class="mail-tile">${icon("send")}</span><span style="text-align:left"><strong>${esc(c.name)}</strong><small>${esc(listName(c))}</small></span></button></td><td data-label="Статус">${badge(campaignStatuses, c.status)}${campaignNext(c)}</td><td data-label="Отправлено">${c.status === "draft" ? '<span class="muted">ещё не запускалась</span>' : `<span class="progress-cell"><strong>${num(st.sent)} из ${num(st.total)}</strong><span class="mini-progress"><span style="width:${donePercent(st)}%"></span></span></span>`}</td><td data-label="Ответили">${st.sent ? num(st.replied) : "—"}</td><td class="connection-actions"><div class="row-actions">${button("Открыть", null, "campaign-open", "compact", `data-id="${c.id}"`)}</div></td></tr>`;
            })
            .join("")}</tbody></table></div>`
        : empty(
            "send",
            "Рассылок пока нет",
            "Нажмите «Новая рассылка» — это займёт пару минут.",
          )
    }</section><p class="page-note">${icon("shield")}Система сама делает паузы между сообщениями, соблюдает дневные лимиты и не пишет тем, кто ответил «СТОП».</p>`
  );
}
// Перерыв между сообщениями в минутах: «от» и «до», выбирается случайно в этих границах
const paceMinutes = (c) => {
  const from = Math.min(15, Math.max(2, Math.round((c.delay_min || 120) / 60)));
  return [from, Math.min(15, Math.max(from, Math.round((c.delay_max || 240) / 60)))];
};
function paceSelects(c, prefix) {
  const [from, to] = paceMinutes(c);
  const opts = (sel) =>
    Array.from({ length: 14 }, (_, k) => k + 2)
      .map((m) => `<option value="${m}" ${m === sel ? "selected" : ""}>${m} мин</option>`)
      .join("");
  return `<div class="pace-row"><span>от</span><select id="${prefix}-from" name="pace_from" aria-label="Перерыв от, минут">${opts(from)}</select><span>до</span><select id="${prefix}-to" name="pace_to" aria-label="Перерыв до, минут">${opts(to)}</select></div>`;
}
const paceBody = (from, to) => {
  const a = Math.max(2, Number(from) || 2);
  return { delay_min: a * 60, delay_max: Math.max(a, Number(to) || a) * 60 };
};
// Один дополнительный вариант текста в форме рассылки
function variantBlock(text = "") {
  return `<div class="variant"><div class="variant-head"><strong class="variant-title"></strong><button type="button" class="chip" data-act="variant-remove">Убрать</button></div>${data.templates.length ? `<select class="variant-template" aria-label="Вставить готовый шаблон"><option value="">Вставить готовый шаблон…</option>${data.templates.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select>` : ""}<textarea name="variant" maxlength="4000" placeholder="Другой текст с тем же смыслом" aria-label="Текст варианта">${esc(text)}</textarea></div>`;
}
function renumberVariants() {
  const list = [...document.querySelectorAll("#c-variants .variant")];
  list.forEach((el, k) => {
    el.querySelector(".variant-title").textContent = `Вариант ${k + 2}`;
  });
  const add = $("#variant-add");
  if (add) add.hidden = list.length >= 9;
}
function campaignForm(existing = null, copy = false, preset = null) {
  const ready = data.instances.filter(isReady);
  const c = {
    name: `Рассылка ${new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: tz }).format(new Date())}`,
    text: "",
    extra_texts: [],
    list_id: data.lists[0]?.id ?? null,
    instance_ids: (ready.length
      ? ready
      : data.instances.filter((i) => i.enabled)
    ).map((i) => i.id),
    delay_min: 120,
    delay_max: 240,
    hour_from: 10,
    hour_to: 20,
    check_wa: 0,
    ...(existing || {}),
    ...(preset || {}),
  };
  if (copy) c.name += " — копия";
  const editId = preset?.editId ?? (existing && !copy ? existing.id : "");
  const status = editId
    ? data.campaigns.find((x) => x.id === Number(editId))?.status || "draft"
    : "draft";
  const lockList = status !== "draft";
  const minDelay = me?.min_delay ?? 5;
  dialogState = { kind: "form" };
  modal(
    editId ? "Изменить рассылку" : "Новая рассылка",
    `<form id="campaign-form" data-edit="${editId}">
<div class="field"><label for="c-list">1. Кому отправляем</label><div class="inline-row"><select id="c-list" name="list_id" ${lockList ? "disabled" : ""}>${data.lists.map((l) => `<option value="${l.id}" ${c.list_id === l.id ? "selected" : ""}>${esc(l.name)} — ${num(l.contacts)}</option>`).join("")}<option value="" ${c.list_id === null ? "selected" : ""}>Все контакты — ${num(data.overview.contacts)}</option></select>${lockList ? "" : button("Загрузить базу", "upload", "form-import")}</div><small>${lockList ? "После запуска базу изменить нельзя." : "Excel или Google Таблица. Отписавшиеся исключаются автоматически."}</small></div>
<div class="field"><label for="c-text">2. Что пишем</label>${data.templates.length ? `<select id="c-template" aria-label="Вставить готовый шаблон"><option value="">Вставить готовый шаблон…</option>${data.templates.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select>` : ""}<textarea id="c-text" name="text" maxlength="4000" placeholder="{Здравствуйте|Добрый день}, {name}!">${esc(c.text)}</textarea>
<div class="hint-row"><button type="button" class="chip" data-act="insert" data-text="{name}">+ имя</button><button type="button" class="chip" data-act="insert" data-text="{Здравствуйте|Добрый день|Приветствуем}">+ варианты {a|b|c}</button><button type="button" class="chip" data-act="insert" data-text="\n\nОтветьте СТОП, чтобы отписаться.">+ «Ответьте СТОП, чтобы отписаться»</button><button type="button" class="chip" data-act="template-save">Сохранить как шаблон</button></div>
<small>{name} подставит имя получателя, {город} — любую колонку вашей таблицы. Варианты в фигурных скобках через «|» чередуются случайно: сообщения не выглядят одинаковыми, и номер живёт дольше. Текст в [квадратных скобках] замените своим.</small></div>
<div class="field"><label>Другие варианты текста (необязательно)</label><div id="c-variants">${(c.extra_texts || []).map(variantBlock).join("")}</div><div class="actions-row"><button type="button" class="button" id="variant-add" data-act="variant-add">${icon("plus")}Добавить ещё вариант текста</button></div><small>Если вариантов несколько, каждому получателю уйдёт один из них — случайно. Так сообщения сильнее отличаются друг от друга.</small></div>
<div class="field"><label for="c-media">Картинка или файл (необязательно)</label><input type="file" id="c-media" aria-describedby="c-media-info"/><input type="hidden" name="media_url" value="${esc(c.media_url || "")}"/><input type="hidden" name="media_name" value="${esc(c.media_name || "")}"/><small id="c-media-info">${c.media_url ? `Прикреплён: ${esc(c.media_name || c.media_url)} · <button type="button" class="chip" data-act="media-clear">убрать</button>` : "Текст сообщения станет подписью к файлу."}</small></div>
<div class="actions-row">${button("Посмотреть, как это увидят получатели", "eye", "preview")}</div><div id="preview" class="preview-list" aria-live="polite"></div>
<details class="advanced"><summary>Дополнительные настройки</summary>
<div class="field"><label for="c-name">Название рассылки</label><input id="c-name" name="name" value="${esc(c.name)}" maxlength="120" required/></div>
<div class="field"><label>С каких номеров отправлять</label><div class="checks">${data.instances.map((i) => `<label class="check"><input type="checkbox" name="instance" value="${i.id}" ${c.instance_ids.includes(i.id) ? "checked" : ""}/>${esc(i.name)} <span class="muted">· до ${num(i.limit_today)} в день${i.state === "authorized" ? "" : " · не подключён"}</span></label>`).join("")}</div></div>
<div class="form-grid"><div class="field"><label>Перерыв между сообщениями</label>${paceSelects(c, "c-pace")}<small>Выбирается случайно в этих границах после каждого сообщения. Раз в 15–25 сообщений номер сам отдыхает 12–20 минут. Менять перерыв можно и во время рассылки.</small></div>
<div class="field"><label for="c-hfrom">Часы отправки</label><div class="form-grid"><input id="c-hfrom" name="hour_from" type="number" min="0" max="23" value="${c.hour_from}" required aria-label="Час с"/><input name="hour_to" type="number" min="1" max="24" value="${c.hour_to}" required aria-label="Час до"/></div><small>Время ${esc(tz)}.</small></div></div>
<div class="field" style="margin-top:17px"><label class="check"><input type="checkbox" name="check_wa" ${c.check_wa ? "checked" : ""}/>Сначала проверять, есть ли у номера WhatsApp</label></div>
${status === "draft" ? `<div class="field"><label for="c-exclude">Не писать тем, кому уже писали за последние N дней</label><input id="c-exclude" name="exclude_recent_days" type="number" min="0" max="3650" value="${Number(c.exclude_recent_days) || 0}"/><small>0 — писать всем из базы.</small></div>` : ""}
</details>
</form>`,
    status === "draft"
      ? `<button type="submit" form="campaign-form" name="mode" value="draft" class="button">Сохранить черновик</button><button type="submit" form="campaign-form" name="mode" value="launch" class="button primary">${icon("play")}Запустить рассылку</button>`
      : button("Отмена", null, "close") +
          `<button type="submit" form="campaign-form" name="mode" value="draft" class="button primary">${icon("check")}Сохранить</button>`,
  );
  renumberVariants();
}
function readCampaignForm() {
  const form = $("#campaign-form");
  const f = new FormData(form);
  return {
    name: String(f.get("name") || "").trim(),
    text: f.get("text"),
    media_url: f.get("media_url") || null,
    media_name: f.get("media_name") || null,
    list_id: form.elements.list_id.value
      ? Number(form.elements.list_id.value)
      : null,
    instance_ids: f.getAll("instance").map(Number),
    extra_texts: f
      .getAll("variant")
      .map(String)
      .filter((t) => t.trim()),
    ...paceBody(f.get("pace_from"), f.get("pace_to")),
    hour_from: Number(f.get("hour_from")),
    hour_to: Number(f.get("hour_to")),
    check_wa: f.get("check_wa") ? 1 : 0,
    exclude_recent_days: Number(f.get("exclude_recent_days")) || 0,
  };
}
// ───── Обратный отсчёт до следующего сообщения ─────
let clockSkew = 0; // часы сервера минус часы браузера, мс
const mmss = (ms) => {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
};
// Кольцо с таймером; цифры и заполнение обновляет tickCountdowns раз в секунду
function countdown(i, label) {
  if (!i.next_send_at) return "";
  return `<div class="countdown" data-next-at="${i.next_send_at}" data-pause="${i.pause_ms || 0}"${i.long_rest ? " data-long" : ""}><span class="countdown-ring" aria-hidden="true"><span class="countdown-time"></span></span><span class="countdown-text"><strong>${label}</strong><small class="countdown-caption"></small></span></div>`;
}
let countdownRefresh = 0;
function tickCountdowns() {
  const now = Date.now() + clockSkew;
  let due = false;
  for (const el of document.querySelectorAll(".countdown")) {
    const left = Number(el.dataset.nextAt) - now;
    const pause = Number(el.dataset.pause) || 0;
    const done = left <= 0;
    el.classList.toggle("is-sending", done);
    el.style.setProperty(
      "--p",
      done || !pause ? 1 : Math.min(1, Math.max(0, 1 - left / pause)),
    );
    el.querySelector(".countdown-time").textContent = done ? "" : mmss(left);
    el.querySelector(".countdown-caption").textContent = done
      ? "Отправляем сообщение…"
      : el.classList.contains("compact")
        ? `${"long" in el.dataset ? "Номер отдыхает, следующее" : "Следующее сообщение"} через ${mmss(left)}`
        : "long" in el.dataset
          ? "длинный отдых номера — защита от блокировки"
          : "до следующего сообщения";
    if (done) due = true;
  }
  // перерыв закончился — подтянем свежие данные, не дожидаясь автообновления
  if (due && !refreshing && Date.now() - countdownRefresh > 4000) {
    countdownRefresh = Date.now();
    refresh();
  }
}
setInterval(tickCountdowns, 1000);
// Номера рассылки, которые сейчас выдерживают перерыв
function waitingNumbers(c) {
  if (c.status !== "running" || !c.stats.queue) return [];
  return data.instances.filter(
    (i) =>
      c.instance_ids.includes(i.id) &&
      isReady(i) &&
      i.next_send_at &&
      i.sent_today < i.limit_today,
  );
}
// Компактный отсчёт для списка рассылок: ближайшая отправка
function campaignNext(c) {
  const soonest = waitingNumbers(c).sort(
    (a, b) => a.next_send_at - b.next_send_at,
  )[0];
  return soonest
    ? countdown(soonest, "").replace('class="countdown"', 'class="countdown compact"')
    : "";
}
function campaignCountdowns(c) {
  const waiting = waitingNumbers(c);
  if (!waiting.length) return "";
  return `<div class="countdown-list">${waiting.map((i) => countdown(i, esc(i.name))).join("")}</div>`;
}
// Понятное объяснение, почему рассылка сейчас не отправляет
function campaignHint(c) {
  const st = c.stats;
  if (c.status === "paused")
    return "Рассылка на паузе. Нажмите «Продолжить», чтобы отправка возобновилась.";
  if (c.status !== "running" || !st.queue) return "";
  const mine = data.instances.filter((i) => c.instance_ids.includes(i.id));
  const ready = mine.filter(isReady);
  if (!ready.length) {
    const stopped = mine.find((i) => !i.enabled && i.disabled_reason);
    return stopped
      ? `Отправка остановлена: номер «${esc(stopped.name)}» выключен (${esc(stopped.disabled_reason)}). Проверьте его во вкладке «WhatsApp-номера».`
      : "Отправка не идёт: номер не подключён. Подключите его во вкладке «WhatsApp-номера» — рассылка продолжится сама.";
  }
  const hour =
    Number(
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        hourCycle: "h23",
        timeZone: tz,
      }).format(new Date()),
    ) % 24;
  if (hour < c.hour_from || hour >= c.hour_to)
    return `Сейчас нерабочее время. Отправка идёт с ${c.hour_from}:00 до ${c.hour_to}:00 и продолжится автоматически.`;
  if (ready.every((i) => i.sent_today >= i.limit_today))
    return "Дневной лимит номера на сегодня исчерпан — так мы бережём номер от блокировки. Завтра отправка продолжится сама.";
  return st.eta_days
    ? `Отправка идёт. Осталось примерно ${num(st.eta_days)} дн.`
    : "Отправка идёт.";
}
function campaignDetail(id) {
  const c = data.campaigns.find((x) => x.id === Number(id));
  if (!c) return;
  const st = c.stats;
  const cells = [
    [st.total, "получателей"],
    [st.sent, "отправлено"],
    [st.delivered, "доставлено"],
    [st.read, "прочитано"],
    [st.replied, "ответили"],
    [st.queue, "в очереди"],
  ];
  const a = (text, ic, act, cls = "") =>
    button(text, ic, act, cls, `data-id="${c.id}"`);
  const footer =
    c.status === "draft"
      ? a("Удалить", "trash", "campaign-delete", "text danger-button") +
        a("Изменить и запустить", "play", "campaign-edit", "primary")
      : c.status === "running"
        ? a(
            "Остановить совсем",
            "stop",
            "campaign-stop",
            "text danger-button",
          ) +
          button("Свернуть", null, "close") +
          a("Пауза", "pause", "campaign-pause", "primary")
        : c.status === "paused"
          ? a(
              "Остановить совсем",
              "stop",
              "campaign-stop",
              "text danger-button",
            ) +
            a("Изменить текст", "edit", "campaign-edit") +
            a("Продолжить", "play", "campaign-resume", "primary")
          : a("Удалить", "trash", "campaign-delete", "text danger-button") +
            (st.failed
              ? a("Повторить ошибки", "refresh", "campaign-retry")
              : "") +
            a("Повторить рассылку", "copy", "campaign-copy", "primary");
  const hint = campaignHint(c);
  const extra = [
    st.failed ? `ошибок: ${num(st.failed)}` : "",
    st.no_wa ? `нет WhatsApp: ${num(st.no_wa)}` : "",
    st.skipped ? `пропущено: ${num(st.skipped)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  dialogState = { kind: "campaign", id: c.id };
  modal(
    esc(c.name),
    `${badge(campaignStatuses, c.status)} <span class="muted">${esc(listName(c))}</span>${
      c.status === "draft"
        ? `<div class="info-box">Это черновик — сообщения ещё не отправлялись.</div>`
        : `<div class="stat-grid">${cells.map(([v, l]) => `<div><strong>${num(v)}</strong><small>${l}</small></div>`).join("")}</div><div class="big-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${donePercent(st)}" aria-label="Обработано"><span style="width:${donePercent(st)}%"></span></div><div class="progress-caption"><span>Обработано ${donePercent(st)}%</span><span>${extra}</span></div>${hint ? `<div class="info-box">${hint}</div>` : ""}${campaignCountdowns(c)}${["running", "paused"].includes(c.status) ? `<form id="pace-form" class="pace-form" data-id="${c.id}"><strong>Перерыв между сообщениями</strong>${paceSelects(c, "d-pace")}<button type="submit" class="button compact">Применить</button></form>` : ""}`
    }${(c.extra_texts || []).length ? `<p class="variant-note">Вариантов текста: ${c.extra_texts.length + 1}. Каждому получателю уходит один из них.</p>` : ""}<div class="preview-email">${esc(c.text) || '<span class="muted">Без текста</span>'}</div>${(c.extra_texts || []).map((t) => `<div class="preview-email">${esc(t)}</div>`).join("")}${c.status === "draft" ? "" : `<div class="actions-row" style="margin-top:16px"><a class="button compact" href="/api/campaigns/${c.id}/export.csv" download>${icon("download")}Скачать отчёт (CSV)</a></div>`}`,
    footer,
  );
}

/* ───────── Шаблоны ───────── */
function templatesPage() {
  return (
    heading(
      "Шаблоны",
      "Готовые тексты: выберите подходящий, замените текст в [скобках] своим — и запускайте.",
      button("Новый шаблон", "plus", "template-new", "primary"),
    ) +
    (data.templates.length
      ? `<div class="tpl-grid">${data.templates.map((t) => `<article class="panel tpl-card"><h3>${esc(t.name)}</h3><div class="tpl-text">${esc(t.text)}</div><div class="actions-row">${button("Использовать", "send", "template-use", "primary compact", `data-id="${t.id}"`)}${button("Изменить", "edit", "template-edit", "compact", `data-id="${t.id}"`)}${button("Удалить", "trash", "template-delete", "text danger-button compact", `data-id="${t.id}"`)}</div></article>`).join("")}</div>`
      : `<section class="panel">${empty("copy", "Шаблонов пока нет", "Сохраните удачный текст, чтобы не набирать его заново.")}</section>`)
  );
}
function templateForm(t = null) {
  dialogState = { kind: "form" };
  modal(
    t ? "Изменить шаблон" : "Новый шаблон",
    `<form id="template-form" data-id="${t?.id || ""}"><div class="field"><label for="t-name">Название</label><input id="t-name" name="name" value="${esc(t?.name || "")}" maxlength="120" required placeholder="Например, приглашение на акцию"/></div><div class="field"><label for="c-text">Текст</label><textarea id="c-text" name="text" maxlength="4000" required placeholder="{Здравствуйте|Добрый день}, {name}!">${esc(t?.text || "")}</textarea><div class="hint-row"><button type="button" class="chip" data-act="insert" data-text="{name}">+ имя</button><button type="button" class="chip" data-act="insert" data-text="{Здравствуйте|Добрый день|Приветствуем}">+ варианты {a|b|c}</button><button type="button" class="chip" data-act="insert" data-text="\n\nОтветьте СТОП, чтобы отписаться.">+ «Ответьте СТОП, чтобы отписаться»</button></div></div></form>`,
    button("Отмена", null, "close") +
      `<button type="submit" form="template-form" class="button primary">${icon("check")}Сохранить</button>`,
  );
}

// Доля в процентах, без деления на ноль
const share = (part, total) =>
  total ? Math.min(100, Math.round((part / total) * 100)) : 0;
function numberCard(i) {
  const on = i.state === "authorized";
  const a = (label, ic, act, cls = "") =>
    button(label, ic, act, cls, `data-id="${i.id}"`);
  const note = !on
    ? "Номер не подключён — сообщения с него не уходят."
    : !i.enabled
      ? `Выключен${i.disabled_reason ? `: ${esc(i.disabled_reason)}` : ""}. Сообщения с него не уходят.`
      : i.sent_today >= i.limit_today
        ? "Лимит на сегодня выбран — продолжит завтра."
        : "";
  return `<article class="number-card${on && i.enabled ? "" : " is-off"}" data-number="${i.id}">
<header><button class="campaign-name" data-act="instance-open" data-id="${i.id}"><span class="mail-tile">${icon("phone")}</span><span><strong>${esc(i.name)}</strong><small>${i.phone ? phoneFmt(i.phone) : "Ждёт подключения"}</small></span></button>${badge(instanceStates, i.state)}</header>
<div class="number-today"><div class="progress-caption"><span>Сегодня отправлено</span><strong>${num(i.sent_today)} из ${num(i.limit_today)}</strong></div><div class="big-progress"><span style="width:${share(i.sent_today, i.limit_today)}%"></span></div></div>
<dl class="number-stats"><div><dt>Отправлено</dt><dd>${num(i.sent_total)}</dd></div><div><dt>Доставлено</dt><dd>${num(i.delivered_total)}</dd></div><div><dt>Прочитано</dt><dd>${num(i.read_total)}</dd></div><div><dt>Ответили</dt><dd>${num(i.replied_total)}</dd></div></dl>
${note ? `<p class="number-note">${note}</p>` : ""}${on && i.enabled ? countdown(i, "Перерыв между сообщениями") : ""}
<div class="number-foot">${on ? `<label class="switch"><input type="checkbox" data-toggle-number="${i.id}" ${i.enabled ? "checked" : ""}/><span class="switch-track"></span><span>${i.enabled ? "Участвует в рассылках" : "Не участвует в рассылках"}</span></label>` : a("Подключить по QR", "qr", "instance-qr", "primary compact")}<div class="row-actions">${on && i.enabled ? a("Написать", "message", "manual-message", "compact") : ""}${a("Подробнее", null, "instance-open", "compact")}</div></div>
</article>`;
}
function numbersPage() {
  const rows = data.instances;
  const ready = rows.filter(isReady);
  const sum = (key, list = rows) =>
    list.reduce((n, i) => n + Number(i[key] || 0), 0);
  const metric = (label, ic, value, bottom) =>
    `<div class="metric"><div class="metric-label">${label}<span class="metric-icon">${icon(ic)}</span></div><div class="metric-value">${value}</div><div class="metric-bottom">${bottom}</div></div>`;
  return (
    heading(
      "WhatsApp-номера",
      "Подключите номера, с которых будете отправлять сообщения.",
      button("Написать сообщение", "message", "manual-message", "primary") +
        button("Подключить номер", "plus", "connect-number"),
    ) +
    (rows.length
      ? `<div class="metrics">${metric("Номеров в работе", "phone", `${num(ready.length)} из ${num(rows.length)}`, ready.length === rows.length ? "Все номера подключены" : "Остальные выключены или не подключены")}${metric("Отправлено сегодня", "send", num(sum("sent_today")), `Лимит на сегодня: ${num(sum("limit_today", ready))}`)}${metric("Отправлено всего", "checkCircle", num(sum("sent_total")), `Доставлено: ${num(sum("delivered_total"))}`)}${metric("Ответили", "message", num(sum("replied_total")), `Не доставлено: ${num(sum("failed_total"))}`)}</div><div class="number-grid">${rows.map(numberCard).join("")}</div>`
      : `<section class="panel">${empty("phone", "Подключите первый номер", "Нажмите «Подключить номер» и наведите камеру телефона на код на экране. Номеров можно подключить несколько.")}</section>`) +
    `<p class="page-note">${icon("qr")}Можно подключить несколько номеров — рассылка распределится между ними сама, и пойдёт быстрее.</p><p class="page-note"><button type="button" class="link-button" data-act="instance-new">Добавить подключение GREEN-API вручную</button></p>`
  );
}
function basePage() {
  const rows = data.lists;
  return (
    heading(
      "База для рассылки",
      "Добавьте получателей из Excel или Google Таблицы.",
      button("Загрузить Excel", "upload", "import", "primary") +
        button("Добавить Google Таблицу", "plus", "import-google"),
    ) +
    importGuide() +
    `<section class="panel"><div class="panel-heading simple-panel-heading"><h2>Загруженные базы <span class="section-count">${rows.length}</span></h2><span class="section-caption">${num(data.overview.contacts)} уникальных контактов</span></div>${rows.length ? `<div class="table-scroll"><table class="connection-table"><thead><tr><th>Название базы</th><th>Контактов</th><th>Дата загрузки</th><th><span class="sr-only">Действия</span></th></tr></thead><tbody>${rows.map((l) => `<tr><td><span class="campaign-name"><span class="mail-tile">${icon("file")}</span><strong>${esc(l.name)}</strong></span></td><td data-label="Контактов">${num(l.contacts)}</td><td data-label="Загружена">${dateTime(l.created_at)}</td><td class="connection-actions"><div class="row-actions"><a class="button compact" href="/api/lists/${l.id}/recipients.csv" download="recipients.csv">${icon("download")}Получатели</a>${button("Удалить", "trash", "list-delete", "text danger-button", `data-id="${l.id}"`)}</div></td></tr>`).join("")}</tbody></table></div>` : empty("database", "Добавьте базу получателей", "Загрузите файл с номерами телефонов. Имена и другие данные о контактах сохранятся вместе с базой.")}</section>`
  );
}
// Добавление подключения GREEN-API: вставить данные целиком или заполнить по полям
function addConnectionDialog(mode = "fields", notice = "") {
  dialogState = { kind: "form" };
  const tab = (key, label) =>
    `<button type="button" class="segment${mode === key ? " active" : ""}" data-act="add-mode" data-mode="${key}" aria-pressed="${mode === key}">${label}</button>`;
  const name = `<div class="field"><label for="i-name">Название номера</label><input id="i-name" name="name" placeholder="Например, Номер 2" maxlength="80"/><small>Как вам удобно его называть. Можно не заполнять.</small></div>`;
  const form =
    mode === "paste"
      ? `<form id="instance-paste-form"><div class="field"><label for="i-raw">Данные из кабинета GREEN-API</label><textarea id="i-raw" name="raw" rows="6" required placeholder="apiUrl  https://7107.api.greenapi.com&#10;idInstance  7107000000&#10;apiTokenInstance  2cc92d61…"></textarea><small>Откройте инстанс в кабинете GREEN-API, выделите мышкой всю табличку с данными, скопируйте и вставьте сюда. Нужные значения найдём сами.</small></div>${name}</form>`
      : `<form id="instance-form">${name}<div class="form-grid"><div class="field"><label for="i-id">idInstance</label><input id="i-id" name="id_instance" inputmode="numeric" required placeholder="7107000000"/></div><div class="field"><label for="i-token">apiTokenInstance</label><input id="i-token" name="api_token" required autocomplete="off"/></div></div><div class="field" style="margin-top:17px"><label for="i-url">apiUrl</label><input id="i-url" name="api_url" placeholder="https://7107.api.greenapi.com"/><small>Указан в карточке инстанса. Если оставить пустым — возьмём адрес по умолчанию.</small></div></form>`;
  modal(
    "Добавить номер",
    `${notice ? `<p class="number-note" style="margin-bottom:16px">${esc(notice)}</p>` : ""}<p>Каждому номеру WhatsApp нужно своё подключение GREEN-API. Создайте и оплатите его в кабинете GREEN-API, затем добавьте сюда — любым из двух способов.</p><div class="segments" role="group" aria-label="Способ добавления">${tab("fields", "Заполнить по полям")}${tab("paste", "Вставить данные целиком")}</div>${form}`,
    button("Отмена", null, "close") +
      `<button type="submit" form="${mode === "paste" ? "instance-paste-form" : "instance-form"}" class="button primary">${icon("check")}Добавить номер</button>`,
  );
  $(mode === "paste" ? "#i-raw" : "#i-name").focus();
}
const instanceForm = () => addConnectionDialog("fields");
async function instanceAdded(r) {
  toast(
    r.webhook === "ok" || r.webhook === "skipped"
      ? "Номер добавлен"
      : `Номер добавлен, но webhook не установлен: ${r.webhook}`,
  );
  await refresh();
  if (r.state === "authorized") instanceDetail(r.id);
  else qrDialog(r.id);
}
// Подключение без камеры: WhatsApp выдаёт код, который вводят на телефоне
function codeDialog(id) {
  const i = data.instances.find((x) => x.id === Number(id));
  if (!i) return;
  clearTimeout(qrTimer);
  dialogState = { kind: "code", id: i.id };
  modal(
    `Подключение по коду · ${esc(i.name)}`,
    `<p>Подходит, если камера не работает или телефон и компьютер — одно устройство. Введите номер WhatsApp, который подключаете.</p><form id="auth-code-form" data-id="${i.id}"><div class="field"><label for="code-phone">Номер телефона WhatsApp</label><input id="code-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 701 123 45 67" required/></div><div id="code-result" class="import-result" aria-live="polite"></div></form>`,
    button("Подключить по QR-коду", "qr", "instance-qr", "", `data-id="${i.id}"`) +
      `<button type="submit" form="auth-code-form" class="button primary">${icon("check")}Получить код</button>`,
  );
  $("#code-phone").focus();
}
function manualMessageDialog(selectedId) {
  const ready = data.instances.filter(
    (i) => i.state === "authorized" && i.enabled,
  );
  if (!ready.length) return toast("Сначала подключите номер WhatsApp");
  dialogState = { kind: "form" };
  modal(
    "Написать сообщение",
    `<p>Введите телефон получателя и текст. Сообщение отправится сразу с выбранного номера.</p><form id="manual-message-form"><div class="field"><label for="manual-instance">Отправить с номера</label><select id="manual-instance" name="instance_id" required>${ready.map((i) => `<option value="${i.id}" ${i.id === Number(selectedId) ? "selected" : ""}>${esc(i.name)}${i.phone ? ` · +${esc(i.phone)}` : ""}</option>`).join("")}</select></div><div class="field"><label for="manual-phone">Телефон получателя</label><input id="manual-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 701 123 45 67" required/><small>Введите номер с кодом страны.</small></div><div class="field"><label for="manual-text">Сообщение</label><textarea id="manual-text" name="text" maxlength="4000" placeholder="Напишите текст сообщения" required></textarea></div><div id="manual-result" class="import-result" aria-live="polite"></div></form>`,
    button("Отмена", null, "close") +
      `<button type="submit" form="manual-message-form" class="button primary">${icon("send")}Отправить</button>`,
  );
  $("#manual-phone").focus();
}

// Отправки номера по дням за последнюю неделю
function weekChart(i) {
  const week = i.week || [];
  if (!week.length) return "";
  const top = Math.max(1, ...week.map((d) => d.count));
  const label = (day) =>
    new Date(day + "T00:00:00").toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
    });
  return `<div class="week-chart"><h3>Отправлено за 7 дней</h3><ul>${week.map((d) => `<li><span class="week-value">${num(d.count)}</span><span class="week-bar"><i style="height:${Math.round((d.count / top) * 100)}%"></i></span><span class="week-day">${label(d.day)}</span></li>`).join("")}</ul></div>`;
}
function instanceDetail(id) {
  const i = data.instances.find((x) => x.id === Number(id));
  if (!i) return;
  dialogState = { kind: "instance", id: i.id };
  const a = (label, ic, act, cls = "") =>
    button(label, ic, act, cls, `data-id="${i.id}"`);
  modal(
    esc(i.name),
    `${badge(instanceStates, i.state)}<dl class="kv"><dt>Телефон</dt><dd>${phoneFmt(i.phone)}</dd><dt>ID подключения</dt><dd>${esc(i.id_instance)}</dd></dl><div class="stat-grid"><div><strong>${num(i.sent_today)}</strong><small>сегодня из ${num(i.limit_today)}</small></div><div><strong>${num(i.sent_total)}</strong><small>отправлено всего</small></div><div><strong>${num(i.delivered_total)}</strong><small>доставлено</small></div><div><strong>${num(i.read_total)}</strong><small>прочитано</small></div><div><strong>${num(i.replied_total)}</strong><small>ответили</small></div><div><strong>${num(i.failed_total)}</strong><small>не доставлено</small></div></div>${weekChart(i)}<div class="actions-row">${i.state === "authorized" && i.enabled ? a("Написать сообщение", "message", "manual-message", "primary") : ""}${a("Обновить статус", "refresh", "instance-refresh")}${i.state === "authorized" ? a("Отключить WhatsApp", "logout", "instance-logout", "danger-button") : a("Подключить по QR", "qr", "instance-qr", "primary")}</div>`,
    a("Удалить номер", "trash", "instance-delete", "text danger-button") +
      button("Закрыть", null, "close"),
  );
}
function qrDialog(id) {
  const i = data.instances.find((x) => x.id === Number(id));
  if (!i) return;
  clearTimeout(qrTimer);
  dialogState = { kind: "qr", id: i.id };
  modal(
    `Подключение · ${esc(i.name)}`,
    `<div class="qr-box" id="qr-box"><p>Запрашиваем QR-код…</p></div>`,
    button("Подключить по коду, без камеры", null, "instance-code", "", `data-id="${i.id}"`) +
      button("Закрыть", null, "close"),
  );
  const poll = async () => {
    if (dialogState?.kind !== "qr" || dialogState.id !== i.id) return;
    const box = $("#qr-box");
    try {
      const r = await api(`/instances/${i.id}/qr`);
      if (dialogState?.kind !== "qr" || !box?.isConnected) return;
      if (r.type === "alreadyLogged") {
        box.innerHTML = `<span class="mail-tile" style="margin:0 auto">${icon("checkCircle")}</span><p><strong>Подключено.</strong><br>Номер готов к работе.</p><div style="margin-top:16px">${data.overview.contacts ? button("Создать рассылку", "send", "campaign-new", "primary") : button("Дальше: загрузить базу", "upload", "import", "primary")}</div>`;
        refresh();
        return;
      }
      if (r.type === "qrCode")
        box.innerHTML = `<img alt="QR-код для подключения WhatsApp" src="data:image/png;base64,${esc(r.message)}"/><ol class="qr-steps"><li>Откройте <strong>WhatsApp</strong> на телефоне.</li><li>Нажмите <strong>⋮</strong> вверху (на iPhone — <strong>«Настройки»</strong> внизу) и выберите <strong>«Связанные устройства»</strong>.</li><li>Нажмите <strong>«Привязка устройства»</strong> и наведите камеру на этот код.</li></ol><p class="muted">Код обновляется сам. Это окно закрывать не нужно.</p>`;
      else if (!box.querySelector("img"))
        box.innerHTML = `<p><strong>Готовим подключение…</strong><br>Обычно это занимает до минуты. Ничего нажимать не нужно — код появится сам.</p>`;
    } catch (e) {
      if (box?.isConnected && !box.querySelector("img"))
        box.innerHTML = `<p><strong>Готовим подключение…</strong><br>Обычно это занимает до минуты. Ничего нажимать не нужно — код появится сам.</p>`;
    }
    qrTimer = setTimeout(poll, 4000);
  };
  poll();
}

function importGuide() {
  return `<section class="panel import-guide" aria-label="Как подготовить базу"><h2>Единый формат базы</h2><ol><li>Скачайте шаблон Excel <strong>.xlsx</strong>. Оставьте один лист с названием <strong>Контакты</strong>.</li><li>Не меняйте первую строку и порядок колонок: <strong>A — Телефон, B — Имя, C — Город</strong>. Вторая строка и ниже — получатели, по одному в строке. Имя и город можно оставить пустыми.</li><li>В колонке A укажите номер с кодом страны: <strong>+7 701 123 45 67</strong>, <strong>8 701 123 45 67</strong> или <strong>+998 90 123 45 67</strong>. Пробелы и скобки допустимы. Формулы и два номера в одной ячейке не используйте.</li><li>Нажмите <strong>Проверить базу</strong>. Система покажет количество получателей и первые 10 номеров. Если есть пустые или некорректные телефоны, исправьте файл и проверьте снова. Только после проверки появится кнопка сохранения базы.</li></ol><div class="table-scroll"><table class="import-example"><caption>Пример строк на листе «Контакты»</caption><thead><tr><th>A · Телефон</th><th>B · Имя</th><th>C · Город</th></tr></thead><tbody><tr><td>+7 701 123 45 67</td><td>Айгуль</td><td>Алматы</td></tr><tr><td>8 705 123 45 68</td><td>Нурлан</td><td>Астана</td></tr></tbody></table></div><p>Повторяющиеся номера попадут в базу один раз. Отписавшиеся не попадут в список получателей. Для текста сообщения можно использовать <strong>{имя}</strong> и <strong>{город}</strong>.</p><a class="button import-template-link" href="/template-contacts.xlsx" download="template-contacts.xlsx">${icon("download")}Скачать шаблон Excel</a></section>`;
}

function googleImportDialog() {
  dialogState = { kind: "form" };
  modal(
    "Добавить Google Таблицу",
    `<p>Откройте доступ «Все, у кого есть ссылка» → «Читатель» и вставьте ссылку. Колонка с телефоном определяется автоматически.</p><form id="google-import-form"><div class="field"><label for="google-url">Ссылка на таблицу</label><input id="google-url" name="url" type="url" inputmode="url" placeholder="https://docs.google.com/spreadsheets/d/…" required/></div><div class="field"><label for="google-name">Название базы</label><input id="google-name" name="name" maxlength="120" placeholder="Например, клиенты за ноябрь"/></div><div id="google-import-result" class="import-result" role="status"></div></form>`,
    button(formDraft ? "Назад к рассылке" : "Отмена", null, formDraft ? "form-resume" : "close") +
      `<button type="submit" form="google-import-form" class="button primary">${icon("upload")}Загрузить контакты</button>`,
  );
}

function importDialog() {
  importPreview = null;
  importPreviewGeneration++;
  dialogState = { kind: "form" };
  modal(
    "Загрузить базу",
    `<p>Загрузите Excel по шаблону. Система проверит номера и покажет получателей до сохранения.</p><div class="actions-row" style="margin-bottom:18px">${button("Вставить ссылку на Google Таблицу", "plus", "import-google")}</div><form id="import-form"><div class="upload-area">${icon("upload")}<strong style="font-size:14px">Файл по шаблону Excel</strong><p>.xlsx · до 100 МБ</p><input type="file" name="file" id="import-file" accept=".xlsx" aria-label="Файл базы" required/></div><div class="field"><label for="import-name">Название базы</label><input id="import-name" name="name" maxlength="120" placeholder="По умолчанию — имя файла"/></div></form><div id="import-result" class="import-result" aria-live="polite"></div>${importGuide()}`,
    button(
      formDraft ? "Назад к рассылке" : "Закрыть",
      null,
      formDraft ? "form-resume" : "close",
    ) +
      `<button type="submit" form="import-form" class="button primary" id="import-submit">${icon("check")}Проверить базу</button>`,
  );
}

const pages = {
  campaigns: campaignsPage,
  numbers: numbersPage,
  base: basePage,
  templates: templatesPage,
};
function renderChrome() {
  const nav = navigation.find((n) => n[0] === page);
  $("#navigation").innerHTML = navigation
    .map(
      ([id, ic, label]) =>
        `<a href="#${id}" class="nav-item ${page === id ? "active" : ""}" ${page === id ? 'aria-current="page"' : ""}>${icon(ic)}<span>${label}</span></a>`,
    )
    .join("");
  $("#breadcrumb-page").textContent = nav[2];
  document.title = `${nav[2]} · Uved.kz`;
}
function render() {
  renderChrome();
  $("#main").innerHTML = loaded
    ? pages[page]()
    : '<div class="empty">Загрузка…</div>';
  renderDock();
  tickCountdowns();
}
// Свёрнутые рассылки: плашка внизу экрана, пока рассылка идёт — видна на любой странице
function renderDock() {
  let dock = $("#dock");
  if (!dock) {
    dock = document.createElement("div");
    dock.id = "dock";
    dock.setAttribute("aria-label", "Идущие рассылки");
    document.body.append(dock);
  }
  const running = loaded
    ? (data.campaigns || []).filter((c) => c.status === "running")
    : [];
  dock.innerHTML = running
    .slice(0, 3)
    .map((c) => {
      const st = c.stats;
      return `<button type="button" class="dock-item" data-act="campaign-open" data-id="${c.id}" title="Открыть рассылку"><span class="dock-top"><span class="dock-dot"></span><strong>${esc(c.name)}</strong><span class="dock-count">${num(st.sent)} из ${num(st.total)}</span></span><span class="mini-progress"><span style="width:${donePercent(st)}%"></span></span>${campaignNext(c) || `<small class="dock-note">${st.queue ? "Ждёт своей очереди" : "Завершается…"}</small>`}</button>`;
    })
    .join("");
}
async function load() {
  const jobs = [
    api("/instances").then((r) => {
      data.instances = r;
      if (r[0]?.server_now) clockSkew = r[0].server_now - Date.now();
    }),
    api("/overview").then((r) => (data.overview = r)),
  ];
  if (page === "base" || page === "campaigns")
    jobs.push(api("/lists").then((r) => (data.lists = r)));
  jobs.push(api("/campaigns").then((r) => (data.campaigns = r)));
  if (page === "templates")
    jobs.push(api("/templates").then((r) => (data.templates = r)));
  await Promise.all(jobs);
  loaded = true;
}
let refreshing = null;
async function refresh() {
  if (!me) return;
  while (refreshing) await refreshing;
  if (!me) return;
  refreshing = (async () => {
    try {
      await load();
      render();
      if ($("#dialog").open && dialogState?.kind === "instance")
        instanceDetail(dialogState.id);
      // пока человек выбирает новый перерыв, окно рассылки не перерисовываем
      if (
        $("#dialog").open &&
        dialogState?.kind === "campaign" &&
        !$("#pace-form")?.dataset.dirty
      )
        campaignDetail(dialogState.id);
    } catch (e) {
      if (me) {
        toast(e.message);
        if (!loaded)
          $("#main").innerHTML =
            `<div class="empty">Не удалось загрузить данные<p>${esc(e.message)}</p><div style="margin-top:18px">${button("Повторить", "refresh", "refresh")}</div></div>`;
      }
    }
  })();
  try {
    await refreshing;
  } finally {
    refreshing = null;
  }
}
function goPage(next) {
  if (page === next) return;
  page = next;
  loaded = false;
  history.replaceState(null, "", "#" + next);
  render();
}
// всё, что нужно форме рассылки, — независимо от открытой вкладки
async function prefetch() {
  [data.instances, data.lists, data.templates, data.overview] =
    await Promise.all([
      api("/instances"),
      api("/lists"),
      api("/templates"),
      api("/overview"),
    ]);
}
async function openCampaignForm(existing = null, copy = false, preset = null) {
  await prefetch();
  if (!data.instances.length) {
    toast("Сначала подключите номер WhatsApp");
    return connectNumber();
  }
  campaignForm(existing, copy, preset);
}
// Одна кнопка: сервер выдаёт свободное подключение или создаёт новое, дальше — только QR-код
async function connectNumber() {
  // без автосоздания подключений кнопка сразу открывает форму добавления номера
  if (!me?.self_connect) return addConnectionDialog("fields");
  let inst;
  try {
    inst = await post("/numbers/connect");
  } catch (e) {
    return addConnectionDialog("fields", e.message);
  }
  // свободных подключений нет — сразу предлагаем добавить новое
  if (inst.full) return addConnectionDialog("fields");
  await refresh();
  qrDialog(inst.id);
}
async function campaignAction(id, action, text) {
  await post(`/campaigns/${id}/${action}`);
  toast(text);
  await refresh();
  campaignDetail(id);
}
function navigate() {
  const requested = location.hash.slice(1);
  const next = navigation.some((n) => n[0] === requested)
    ? requested
    : "campaigns";
  if (requested !== next) history.replaceState(null, "", "#" + next);
  if (next !== page) {
    loaded = false;
    closeDialog();
  }
  page = next;
  $("#sidebar").classList.remove("open");
  $("#mobile-menu").setAttribute("aria-expanded", "false");
  if (!me) return;
  render();
  window.scrollTo(0, 0);
  refresh();
}
window.addEventListener("hashchange", navigate);
function modal(title, body, footer = "") {
  const dialog = $("#dialog");
  $("#dialog-content").innerHTML =
    `<div class="dialog-header"><h2>${title}</h2><button class="icon-button" data-act="close" aria-label="Закрыть">${icon("close")}</button></div><div class="dialog-body">${body}</div>${footer ? `<div class="dialog-footer">${footer}</div>` : ""}`;
  if (!dialog.open) dialog.showModal();
  tickCountdowns();
}
function closeDialog() {
  dialogState = null;
  clearTimeout(qrTimer);
  if ($("#dialog").open) $("#dialog").close();
}
$("#dialog").addEventListener("close", () => {
  dialogState = null;
  clearTimeout(qrTimer);
});
$("#dialog").addEventListener("click", (e) => {
  if (e.target !== $("#dialog")) return;
  const r = e.target.getBoundingClientRect();
  if (
    e.clientX < r.left ||
    e.clientX > r.right ||
    e.clientY < r.top ||
    e.clientY > r.bottom
  )
    closeDialog();
});
let confirmAction = null;
function confirmDialog(title, text, label, action) {
  confirmAction = action;
  dialogState = { kind: "form" };
  modal(
    title,
    `<p>${text}</p>`,
    button("Отмена", null, "close") + button(label, null, "confirm", "primary"),
  );
}
async function instanceAction(id, fn, text) {
  await fn();
  toast(text);
  await refresh();
  instanceDetail(id);
}
const actions = {
  close: closeDialog,
  refresh,
  confirm: async () => {
    const fn = confirmAction;
    confirmAction = null;
    if (fn) await fn();
  },
  "campaign-new": () => {
    formDraft = null;
    return openCampaignForm();
  },
  "campaign-open": (el) => campaignDetail(el.dataset.id),
  "campaign-edit": (el) =>
    openCampaignForm(
      data.campaigns.find((c) => c.id === Number(el.dataset.id)),
    ),
  "campaign-copy": (el) => {
    const { id, status, stats, ...src } = data.campaigns.find(
      (c) => c.id === Number(el.dataset.id),
    );
    formDraft = null;
    return openCampaignForm(src, true);
  },
  "campaign-pause": (el) =>
    campaignAction(el.dataset.id, "pause", "Рассылка на паузе"),
  "campaign-resume": (el) =>
    campaignAction(el.dataset.id, "resume", "Рассылка продолжена"),
  "campaign-retry": (el) =>
    campaignAction(
      el.dataset.id,
      "retry",
      "Сообщения с ошибками отправим ещё раз",
    ),
  "campaign-stop": (el) => {
    const id = el.dataset.id;
    confirmDialog(
      "Остановить рассылку?",
      "Оставшиеся в очереди сообщения не будут отправлены. Продолжить остановленную рассылку нельзя — если хотите вернуться позже, используйте «Паузу».",
      "Остановить",
      () => campaignAction(id, "stop", "Рассылка остановлена"),
    );
  },
  "campaign-delete": (el) => {
    const id = el.dataset.id;
    confirmDialog(
      "Удалить рассылку?",
      "Рассылка и её отчёт будут удалены без возможности восстановления.",
      "Удалить",
      async () => {
        await api(`/campaigns/${id}`, { method: "DELETE" });
        closeDialog();
        toast("Рассылка удалена");
        await refresh();
      },
    );
  },
  "connect-number": connectNumber,
  "import-confirm": async () => {
    if (!importPreview) return toast("Сначала проверьте базу");
    const out = $("#import-result");
    const fd = new FormData();
    fd.append("file", importPreview.file);
    fd.append("hash", importPreview.hash);
    fd.append("name", $("#import-name").value.trim());
    out.textContent = "Сохраняем проверенную базу…";
    try {
      const r = await api("/import-standard", { method: "POST", form: fd });
      importPreview = null;
      out.innerHTML = `<strong>База «${esc(r.list_name)}» сохранена.</strong><p>Получателей после исключения отписавшихся: ${num(r.valid - r.opted_out)}. Дублей в файле: ${num(r.duplicates)}.</p><div class="actions-row"><a class="button" href="/api/lists/${r.list_id}/recipients.csv" download="recipients.csv">${icon("download")}Скачать полный список получателей</a>${button(formDraft ? "Продолжить рассылку с этой базой" : "Создать рассылку по этой базе", "send", "form-resume", "primary", `data-list="${r.list_id}"`)}</div>`;
      $("#import-form").reset();
      await refresh();
    } catch (e) {
      out.innerHTML = `<span class="error-text">${esc(e.message)}</span>`;
    }
  },
  "form-import": () => {
    formDraft = {
      ...readCampaignForm(),
      editId: $("#campaign-form").dataset.edit,
    };
    importDialog();
  },
  "form-resume": (el) => {
    const d = formDraft || {};
    formDraft = null;
    if (el.dataset.list) d.list_id = Number(el.dataset.list);
    return openCampaignForm(null, false, d);
  },
  insert: (el) => {
    const t = $("#c-text");
    const start = t.selectionStart ?? t.value.length;
    t.setRangeText(el.dataset.text, start, t.selectionEnd ?? start, "end");
    t.focus();
  },
  "media-clear": () => {
    const form = $("#campaign-form");
    form.elements.media_url.value = "";
    form.elements.media_name.value = "";
    $("#c-media").value = "";
    $("#c-media-info").textContent = "Файл убран.";
  },
  preview: async () => {
    const f = readCampaignForm();
    const rows = await post("/preview", { text: f.text, list_id: f.list_id });
    $("#preview").innerHTML = rows.length
      ? rows
          .map(
            (r) =>
              `<div class="preview-email"><small>${phoneFmt(r.phone)}${r.name ? " · " + esc(r.name) : ""}</small>${esc(r.text) || '<span class="muted">Пустой текст</span>'}</div>`,
          )
          .join("")
      : `<div class="info-box">В выбранной базе пока нет контактов — загрузите базу.</div>`;
  },
  "template-new": () => templateForm(),
  "template-edit": (el) =>
    templateForm(data.templates.find((t) => t.id === Number(el.dataset.id))),
  "template-use": (el) => {
    formDraft = null;
    return openCampaignForm(null, false, {
      text:
        data.templates.find((t) => t.id === Number(el.dataset.id))?.text || "",
    });
  },
  "template-delete": (el) => {
    const id = el.dataset.id;
    confirmDialog(
      "Удалить шаблон?",
      "Шаблон будет удалён. На уже созданные рассылки это не повлияет.",
      "Удалить",
      async () => {
        await api(`/templates/${id}`, { method: "DELETE" });
        closeDialog();
        toast("Шаблон удалён");
        await refresh();
      },
    );
  },
  "template-save": async () => {
    const text = $("#c-text").value;
    if (!text.trim()) return toast("Сначала напишите текст");
    const t = await post("/templates", {
      name: $("#c-name").value.trim() || "Мой шаблон",
      text,
    });
    data.templates.unshift(t);
    toast(`Шаблон «${t.name}» сохранён во вкладке «Шаблоны»`);
  },
  "instance-new": instanceForm,
  "manual-message": (el) => manualMessageDialog(el.dataset.id),
  "instance-open": (el) => instanceDetail(el.dataset.id),
  "variant-add": () => {
    $("#c-variants").insertAdjacentHTML("beforeend", variantBlock());
    renumberVariants();
    $("#c-variants .variant:last-child textarea").focus();
  },
  "variant-remove": (el) => {
    el.closest(".variant").remove();
    renumberVariants();
  },
  "instance-qr": (el) => qrDialog(el.dataset.id),
  "instance-code": (el) => codeDialog(el.dataset.id),
  "add-mode": (el) => addConnectionDialog(el.dataset.mode),
  "instance-refresh": (el) =>
    instanceAction(
      el.dataset.id,
      () => post(`/instances/${el.dataset.id}/refresh`),
      "Статус обновлён",
    ),
  "instance-logout": (el) => {
    const id = el.dataset.id;
    confirmDialog(
      "Отключить WhatsApp?",
      "Для повторного подключения потребуется отсканировать QR-код.",
      "Отключить",
      () =>
        instanceAction(
          id,
          () => post(`/instances/${id}/logout`),
          "WhatsApp отключён",
        ),
    );
  },
  "instance-delete": (el) => {
    const id = el.dataset.id;
    confirmDialog(
      "Удалить номер?",
      "Номер будет удалён из панели. Инстанс в GREEN-API останется.",
      "Удалить",
      async () => {
        await api(`/instances/${id}`, { method: "DELETE" });
        closeDialog();
        toast("Номер удалён");
        await refresh();
      },
    );
  },
  import: importDialog,
  "import-google": googleImportDialog,
  "list-delete": (el) => {
    const id = el.dataset.id;
    const list = data.lists.find((l) => l.id === Number(id));
    confirmDialog(
      "Удалить базу?",
      `«${esc(list?.name)}» будет удалена. Контакты, которые не используются в других базах и истории сообщений, также удалятся.`,
      "Удалить",
      async () => {
        const r = await api(`/lists/${id}`, { method: "DELETE" });
        closeDialog();
        toast(`База удалена. Удалено контактов: ${num(r.removed)}`);
        await refresh();
      },
    );
  },
  logout: async () => {
    await post("/logout");
    showLogin();
  },
};
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el || el.disabled || !actions[el.dataset.act]) return;
  el.disabled = true;
  Promise.resolve()
    .then(() => actions[el.dataset.act](el))
    .catch(fail)
    .finally(() => {
      if (el.isConnected) el.disabled = false;
    });
});
document.addEventListener("change", async (e) => {
  const t = e.target;
  try {
    if (t.id === "import-file") {
      importPreview = null;
      importPreviewGeneration++;
      $("#import-result").textContent =
        "Файл выбран. Нажмите «Проверить базу».";
    }
    if (t.dataset.toggleNumber) {
      const on = t.checked;
      t.disabled = true;
      try {
        await api(`/instances/${t.dataset.toggleNumber}`, {
          method: "PATCH",
          body: { enabled: on },
        });
        toast(on ? "Номер участвует в рассылках" : "Номер выключен из рассылок");
      } finally {
        await refresh();
      }
      return;
    }
    if (t.classList.contains("variant-template") && t.value) {
      const tpl = data.templates.find((x) => x.id === Number(t.value));
      const area = t.closest(".variant").querySelector("textarea");
      if (tpl) area.value = tpl.text;
      t.value = "";
      area.focus();
    }
    if (t.closest("#pace-form")) t.closest("#pace-form").dataset.dirty = "1";
    if (t.name === "pace_from") {
      const to = t.parentElement.querySelector('[name="pace_to"]');
      if (Number(to.value) < Number(t.value)) to.value = t.value;
    }
    if (t.name === "pace_to") {
      const from = t.parentElement.querySelector('[name="pace_from"]');
      if (Number(from.value) > Number(t.value)) from.value = t.value;
    }
    if (t.id === "c-template" && t.value) {
      const tpl = data.templates.find((x) => x.id === Number(t.value));
      if (tpl) $("#c-text").value = tpl.text;
      t.value = "";
      $("#c-text").focus();
    }
    if (t.id === "c-media" && t.files[0]) {
      const info = $("#c-media-info");
      info.textContent = "Загружаем файл…";
      const form = new FormData();
      form.append("file", t.files[0]);
      const r = await api("/media", { method: "POST", form });
      const f = $("#campaign-form");
      f.elements.media_url.value = r.url;
      f.elements.media_name.value = r.name;
      info.textContent = `Прикреплён: ${r.name}`;
    }
  } catch (err) {
    if (t.id === "c-media") {
      t.value = "";
      $("#c-media-info").textContent = err.message;
    }
    fail(err);
  }
});
const submitters = {
  "google-import-form": async (form) => {
    const out = $("#google-import-result");
    out.textContent = "Загружаем контакты из Google Таблицы…";
    try {
      const r = await post(
        "/import-url",
        Object.fromEntries(new FormData(form)),
      );
      await refresh();
      out.innerHTML = `<div class="info-box"><strong>База «${esc(r.list_name)}» добавлена.</strong><p>Контактов: ${num(r.valid)} · дублей: ${num(r.duplicates)} · некорректных строк: ${num(r.invalid)}</p></div><div class="actions-row">${button(formDraft ? "Продолжить рассылку с этой базой" : "Создать рассылку по этой базе", "send", "form-resume", "primary", `data-list="${r.list_id}"`)}</div>`;
      document.querySelector('button[form="google-import-form"]')?.remove();
      toast("Контакты добавлены");
    } catch (e) {
      out.innerHTML = `<p class="error-text">${esc(e.message)}</p>`;
    }
  },
  "manual-message-form": async (form) => {
    const out = $("#manual-result");
    out.textContent = "Отправляем сообщение…";
    const fields = Object.fromEntries(new FormData(form));
    try {
      await post(`/instances/${fields.instance_id}/test`, {
        phone: fields.phone,
        text: fields.text,
      });
      out.innerHTML = "<strong>Сообщение отправлено.</strong>";
      form.elements.phone.value = "";
      form.elements.text.value = "";
      toast("Сообщение отправлено");
    } catch (e) {
      out.innerHTML = `<span class="error-text">${esc(e.message)}</span>`;
    }
  },
  "campaign-form": async (form, submitter) => {
    const { exclude_recent_days, ...body } = readCampaignForm();
    const launch = submitter?.value === "launch";
    if (
      launch &&
      !data.instances.some(
        (i) => body.instance_ids.includes(i.id) && isReady(i),
      )
    ) {
      toast("Подключите WhatsApp-номер перед запуском");
      return;
    }
    if (
      launch &&
      !(body.list_id
        ? data.lists.find((l) => l.id === body.list_id)?.contacts
        : data.overview.contacts)
    ) {
      toast("Сначала загрузите базу получателей");
      return;
    }
    if (launch && !body.text?.trim() && !body.media_url) {
      toast("Напишите текст сообщения или прикрепите файл");
      return;
    }
    const id = form.dataset.edit;
    const saved = id
      ? await api(`/campaigns/${id}`, { method: "PUT", body })
      : await post("/campaigns", body);
    let message = id ? "Изменения сохранены" : "Черновик сохранён";
    if (launch) {
      try {
        const r = await post(`/campaigns/${saved.id}/start`, {
          exclude_recent_days,
        });
        message = `Рассылка запущена, получателей: ${num(r.stats.total)}`;
      } catch (e) {
        message = `Черновик сохранён, но запустить не удалось: ${e.message}`;
      }
    }
    formDraft = null;
    goPage("campaigns");
    toast(message);
    await refresh();
    campaignDetail(saved.id);
  },
  "pace-form": async (form) => {
    const f = new FormData(form);
    const body = paceBody(f.get("pace_from"), f.get("pace_to"));
    await post(`/campaigns/${form.dataset.id}/pace`, body);
    delete form.dataset.dirty;
    toast(
      `Перерыв изменён: ${body.delay_min === body.delay_max ? "" : `от ${body.delay_min / 60} до `}${body.delay_max / 60} мин`,
    );
    await refresh();
  },
  "template-form": async (form) => {
    const id = form.dataset.id;
    const body = Object.fromEntries(new FormData(form));
    if (id) await api(`/templates/${id}`, { method: "PUT", body });
    else await post("/templates", body);
    closeDialog();
    toast("Шаблон сохранён");
    goPage("templates");
    await refresh();
  },
  "instance-form": async (form) =>
    instanceAdded(
      await post("/instances", Object.fromEntries(new FormData(form))),
    ),
  "instance-paste-form": async (form) =>
    instanceAdded(
      await post("/instances", Object.fromEntries(new FormData(form))),
    ),
  "auth-code-form": async (form) => {
    const id = Number(form.dataset.id);
    const out = $("#code-result");
    out.textContent = "Запрашиваем код…";
    let r;
    try {
      r = await post(`/instances/${id}/auth-code`, {
        phone: new FormData(form).get("phone"),
      });
    } catch (e) {
      out.innerHTML = `<p class="error-text">${esc(e.message)}</p>`;
      return;
    }
    out.innerHTML = `<div class="auth-code" aria-label="Код подключения">${esc(r.code.slice(0, 4))}<span>–</span>${esc(r.code.slice(4))}</div><ol class="qr-steps"><li>Откройте <strong>WhatsApp</strong> на телефоне с этим номером.</li><li>Нажмите <strong>⋮</strong> вверху (на iPhone — <strong>«Настройки»</strong> внизу) и выберите <strong>«Связанные устройства»</strong>.</li><li>Нажмите <strong>«Привязка устройства»</strong>, затем <strong>«Связать по номеру телефона»</strong> и введите этот код.</li></ol><p class="muted" id="code-wait">Ждём подтверждения на телефоне. Это окно закрывать не нужно.</p>`;
    const poll = async () => {
      if (dialogState?.kind !== "code" || dialogState.id !== id) return;
      try {
        const st = await post(`/instances/${id}/refresh`);
        if (dialogState?.kind !== "code" || !out.isConnected) return;
        if (st.state === "authorized") {
          out.innerHTML = `<div class="qr-box"><span class="mail-tile" style="margin:0 auto">${icon("checkCircle")}</span><p><strong>Подключено.</strong><br>Номер готов к работе.</p></div>`;
          refresh();
          return;
        }
      } catch {
        /* повторим */
      }
      qrTimer = setTimeout(poll, 4000);
    };
    clearTimeout(qrTimer);
    qrTimer = setTimeout(poll, 3000);
  },
  "import-form": async (form) => {
    const out = $("#import-result");
    const generation = ++importPreviewGeneration;
    out.textContent = "Проверяем файл и номера…";
    try {
      const fd = new FormData(form);
      const file = fd.get("file");
      if (!file?.size) throw new Error("Выберите файл по шаблону Excel .xlsx");
      const r = await api("/import-standard/preview", {
        method: "POST",
        form: fd,
      });
      if (generation !== importPreviewGeneration) return;
      importPreview = r.can_import ? { file, hash: r.hash } : null;
      out.innerHTML = `<div class="info-box"><strong>${r.can_import ? "Проверка пройдена" : "Исправьте файл перед загрузкой"}</strong><dl class="kv"><dt>Колонка получателя</dt><dd>${esc(r.phone_column)}</dd><dt>Строк в файле</dt><dd>${num(r.rows)}</dd><dt>Уникальных номеров</dt><dd>${num(r.valid)}</dd><dt>Дублей</dt><dd>${num(r.duplicates)}</dd><dt>Некорректных строк</dt><dd>${num(r.invalid)}</dd><dt>В стоп-листе</dt><dd>${num(r.opted_out)}</dd><dt>Получателей рассылки</dt><dd><strong>${num(r.recipients)}</strong></dd></dl>${r.invalid ? `<p class="error-text">Примеры ошибок: ${esc(r.invalid_examples.filter(Boolean).slice(0, 5).join(", ") || "пустые номера")}. Исправьте файл и проверьте снова.</p>` : ""}</div>${r.sample.length ? `<div class="table-scroll"><table class="import-example"><caption>Первые ${r.sample.length} получателей после проверки</caption><thead><tr><th>Телефон</th><th>Имя</th></tr></thead><tbody>${r.sample.map((c) => `<tr><td>+${esc(c.phone)}</td><td>${esc(c.name || "—")}</td></tr>`).join("")}</tbody></table></div>` : ""}${r.can_import ? `<div class="actions-row">${button("Сохранить проверенную базу", "check", "import-confirm", "primary")}</div>` : ""}`;
    } catch (e) {
      if (generation !== importPreviewGeneration) return;
      importPreview = null;
      out.innerHTML = `<span class="error-text">${esc(e.message)}</span>`;
    }
  },
  "login-form": async (form) => {
    $("#login-error").textContent = "";
    try {
      await post("/login", Object.fromEntries(new FormData(form)));
      form.reset();
      await start();
    } catch (e) {
      $("#login-error").textContent = e.message;
    }
  },
};

document.addEventListener("submit", (e) => {
  const fn = submitters[e.target.id];
  if (!fn) return;
  e.preventDefault();
  if (e.target.dataset.busy) return;
  const form = e.target;
  const submitter = e.submitter;
  const submit =
    submitter ||
    document.querySelector(
      `button[type="submit"][form="${form.id}"], #${form.id} button[type="submit"]`,
    );
  form.dataset.busy = "true";
  if (submit) submit.disabled = true;
  Promise.resolve()
    .then(() => fn(form, submitter))
    .catch(fail)
    .finally(() => {
      delete form.dataset.busy;
      if (submit?.isConnected) submit.disabled = false;
    });
});
$("#mobile-menu").onclick = () => {
  const open = $("#sidebar").classList.toggle("open");
  $("#mobile-menu").setAttribute("aria-expanded", String(open));
};
$("#scrim").onclick = () => {
  $("#sidebar").classList.remove("open");
  $("#mobile-menu").setAttribute("aria-expanded", "false");
};
for (const id of ["profile", "account"])
  $("#" + id).onclick = () =>
    confirmDialog(
      "Выйти из аккаунта?",
      "Чтобы войти снова, понадобятся логин и пароль.",
      "Выйти",
      actions.logout,
    );
function showLogin() {
  me = null;
  closeDialog();
  $("#login").hidden = false;
  $("#login-name").focus();
}
async function start() {
  try {
    if (!(await api("/login")).ok) return showLogin();
    me = await api("/me");
    tz = me.tz || tz;
    $("#login").hidden = true;
    navigate();
  } catch (e) {
    showLogin();
    $("#login-error").textContent = e.message;
  }
}
setInterval(() => {
  if (!document.hidden && !refreshing && me) refresh();
}, 10000);
start();
