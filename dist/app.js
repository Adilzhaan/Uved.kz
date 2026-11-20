"use strict";
const paths = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  send: "m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  template: "M4 3h16v18H4z M4 9h16 M10 9v12",
  chart: "M4 3v18h17 M9 16v-5 M14 16V6 M19 16v-8",
  settings:
    "M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  mail: "M3 5h18v14H3z m0 1 9 7 9-7",
  check: "m5 12 4 4L19 6",
  checkCircle: "M22 11.1V12a10 10 0 1 1-5.9-9.14 M22 4 12 14l-3-3",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  click: "m4 3 7 18 3-7 7-3L4 3Z m10 11 6 6",
  chevrons: "m9 8 3-3 3 3 m-6 8 3 3 3-3",
  down: "m6 9 6 6 6-6",
  left: "m14 6-6 6 6 6",
  right: "m10 6 6 6-6 6",
  zap: "m13 2-9 12h7l-1 8 10-12h-7l1-8Z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
  help: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4 M12 17h.01",
  calendar: "M4 5h16v16H4z M16 3v4 M8 3v4 M4 11h16",
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
  copy: "M9 9h12v12H9z M5 15H3V3h12v2",
  file: "M14 2H4v20h16V8l-6-6Z M14 2v6h6 M8 13h8 M8 17h6",
  logout: "M9 3H3v18h6 M10 12h12 m-5-5 5 5-5 5",
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
const num = (n) => Number(n).toLocaleString("ru-RU");
const date = (s) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Almaty",
  }).format(new Date(s));
const seed = [
  {
    id: "c1",
    name: "Ноябрьский дайджест",
    subject: "Всё важное за ноябрь — в одном письме",
    segment: "Все подписчики",
    status: "running",
    total: 24500,
    sent: 18620,
    opens: 43.2,
    clicks: 5.8,
    date: "2026-11-20T04:00:00Z",
    color: "",
    body: "Здравствуйте, {{name}}!\n\nСобрали для вас главные новости, полезные материалы и обновления этого месяца. Спасибо, что остаётесь с нами!\n\nКоманда Nalog Project",
  },
  {
    id: "c2",
    name: "Важное обновление сервиса",
    subject: "Ваше рабочее пространство стало удобнее",
    segment: "Активные пользователи",
    status: "done",
    total: 28400,
    sent: 28400,
    opens: 48.6,
    clicks: 7.2,
    date: "2026-11-19T04:00:00Z",
    color: "lilac",
    body: "Здравствуйте, {{name}}!\n\nМы подготовили обновление сервиса. Уже сейчас вы можете попробовать новые функции в личном кабинете.",
  },
  {
    id: "c3",
    name: "Напоминание об оплате",
    subject: "Напоминаем о предстоящей оплате",
    segment: "Клиенты с подпиской",
    status: "scheduled",
    total: 12500,
    sent: 0,
    opens: 0,
    clicks: 0,
    date: "2026-11-21T04:00:00Z",
    color: "peach",
    body: "Здравствуйте, {{name}}!\n\nПриближается дата очередной оплаты. Подробности доступны в вашем личном кабинете.",
  },
  {
    id: "c4",
    name: "Добро пожаловать в Nalog",
    subject: "Рады видеть вас в Nalog Project",
    segment: "Новые подписчики",
    status: "done",
    total: 21400,
    sent: 21400,
    opens: 54.3,
    clicks: 9.1,
    date: "2026-11-18T04:00:00Z",
    color: "blue",
    body: "Здравствуйте, {{name}}!\n\nДобро пожаловать! Мы подготовили всё, чтобы вам было легко начать. Познакомьтесь с возможностями сервиса в вашем личном кабинете.",
  },
  {
    id: "c5",
    name: "Декабрь: планы и обновления",
    subject: "Что вас ждёт в декабре",
    segment: "Все подписчики",
    status: "draft",
    total: 5200,
    sent: 0,
    opens: 0,
    clicks: 0,
    date: "2026-11-20T05:00:00Z",
    color: "lilac",
    body: "Здравствуйте, {{name}}!\n\nРассказываем о планах на следующий месяц.",
  },
];
const defaultSettings = {
  workspace: "Nalog Project",
  sender: "Команда Nalog",
  email: "hello@example.com",
  reply: "support@example.com",
  timezone: "Asia/Almaty",
};
function read(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}
let campaigns = read("pulse.campaigns.v1", seed);
if (
  !Array.isArray(campaigns) ||
  campaigns.some((c) => !c || !c.id || !c.name || typeof c.sent !== "number")
)
  campaigns = structuredClone(seed);
let contacts = read("pulse.contacts.v1", []);
if (
  !Array.isArray(contacts) ||
  contacts.some((c) => !c || typeof c.email !== "string")
)
  contacts = [];
let settings = { ...defaultSettings, ...read("pulse.settings.v1", {}) };
let page = "overview",
  filter = "all",
  query = "",
  period = "week",
  currentPage = 1,
  contactQuery = "";
const navigation = [
  ["overview", "grid", "Обзор"],
  ["campaigns", "send", "Рассылки"],
  ["audience", "users", "Аудитория"],
  ["templates", "template", "Шаблоны"],
  ["analytics", "chart", "Аналитика"],
  ["settings", "settings", "Настройки"],
];
const statuses = {
  running: ["Отправляется", "running"],
  done: ["Завершена", "done"],
  scheduled: ["Запланирована", "scheduled"],
  draft: ["Черновик", ""],
  paused: ["На паузе", "paused"],
};
let toastTimer;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 4200);
}
function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    toast(
      "Не удалось сохранить: хранилище браузера недоступно или переполнено.",
    );
    return false;
  }
}
function saveCampaigns() {
  return persist("pulse.campaigns.v1", campaigns);
}
function badge(status) {
  const s = statuses[status] || statuses.draft;
  return `<span class="badge ${s[1]}"><i></i>${s[0]}</span>`;
}
function button(text, ic, action, cls = "") {
  return `<button class="button ${cls}" data-action="${action}">${ic ? icon(ic) : ""}${text}</button>`;
}
function heading(
  title,
  subtitle,
  actions = "",
  eyebrow = "РАБОЧЕЕ ПРОСТРАНСТВО",
) {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div><div class="heading-actions">${actions}</div></div>`;
}
function metrics() {
  const values = [
    ["Отправлено сообщений", "68 420", "send", "12,8%", "за прошлый период"],
    ["Доставлено", "98,2%", "checkCircle", "1,4%", "за прошлый период"],
    ["Открываемость", "42,8%", "eye", "5,2%", "за прошлый период"],
    ["Переходы по ссылкам", "6,4%", "click", "0,8%", "за прошлый период"],
  ];
  return `<div class="metrics">${values.map((m, i) => `<article class="metric"><div class="metric-label">${m[0]}<span class="metric-icon">${icon(m[2])}</span></div><div class="metric-value">${m[1]}</div><div class="metric-bottom"><span class="delta">↗ ${m[3]}</span><span>${m[4]}</span></div><svg class="metric-spark" viewBox="0 0 70 35" fill="none" aria-hidden="true"><path d="M1 28 9 22 17 25 25 16 33 20 41 10 49 15 57 5 69 3" stroke="${["#a9c88b", "#8db7a0", "#b0a2d2", "#d6ba84"][i]}" stroke-width="1.5"/></svg></article>`).join("")}</div>`;
}
function chart() {
  const monthly = period === "month";
  const labels = monthly
    ? ["01 ноя", "05 ноя", "10 ноя", "15 ноя", "20 ноя", "25 ноя", "30 ноя"]
    : ["14 ноя", "15 ноя", "16 ноя", "17 ноя", "18 ноя", "19 ноя", "20 ноя"];
  const line = monthly
    ? "M35 130 C70 120 83 110 122 115 S180 45 209 65 S270 120 296 70 S351 95 383 40 S440 65 470 30 S528 45 557 16"
    : "M35 127 C65 129 87 119 122 109 S180 122 209 90 S266 108 296 77 S347 70 383 81 S435 64 470 49 S530 66 557 21";
  return `<section class="panel activity-panel"><div class="panel-heading"><div><h2>Активность рассылок</h2><p>Сообщения, которые находят отклик</p></div><div class="segmented" aria-label="Период графика"><button data-period="week" class="${!monthly ? "selected" : ""}" aria-pressed="${!monthly}">Неделя</button><button data-period="month" class="${monthly ? "selected" : ""}" aria-pressed="${monthly}">Месяц</button></div></div><div class="chart-legend"><span class="legend-entry"><i class="legend-dot"></i>Отправлено</span><span class="legend-entry"><i class="legend-dot purple"></i>Открыто</span></div><div class="chart-wrap"><svg class="chart" viewBox="0 0 580 185" role="img" aria-label="Демонстрационная динамика отправок и открытий за ${monthly ? "ноябрь" : "14–20 ноября"}"><defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#dceccd" stop-opacity=".7"/><stop offset="100%" stop-color="#f8fbf5" stop-opacity=".2"/></linearGradient></defs>${[20, 60, 100, 140].map((y, i) => `<line class="gridline" x1="35" x2="557" y1="${y}" y2="${y}"/><text x="0" y="${y + 3}">${[15, 10, 5, 0][i]}${i < 3 ? " тыс." : ""}</text>`).join("")}<path class="area" d="${line} L557 140 L35 140 Z"/><path class="sent-line" d="${line}"/><path class="open-line" d="${monthly ? "M35 137 C80 138 90 124 122 130 S177 97 209 111 S262 132 296 113 S351 126 383 89 S435 103 470 83 S529 97 557 68" : "M35 139 C70 138 90 133 122 133 S176 132 209 119 S261 126 296 111 S351 108 383 112 S433 98 470 96 S527 102 557 80"}"/>${labels.map((l, i) => `<text x="${35 + i * 87}" y="173" text-anchor="${i === 0 ? "start" : i === 6 ? "end" : "middle"}">${l}</text>`).join("")}</svg></div></section>`;
}
function delivery() {
  return `<section class="panel"><div class="panel-heading"><div><h2>Доставляемость</h2><p>Каждое сообщение под контролем</p></div></div><div class="delivery-body"><div class="donut-wrap"><svg class="donut" viewBox="0 0 146 146" role="img" aria-label="Доставлено 98,2 процента"><circle cx="73" cy="73" r="57" fill="none" stroke="#edf1e8" stroke-width="11"/><circle cx="73" cy="73" r="57" fill="none" stroke="#bedc9d" stroke-width="11" stroke-dasharray="351.69 358.14" stroke-linecap="round"/><circle cx="73" cy="73" r="57" fill="none" stroke="#cbb7db" stroke-width="11" stroke-dasharray="3.22 358.14" stroke-dashoffset="-352.5"/></svg><div class="donut-center"><strong>98,2<span style="display:inline;font-size:19px;color:inherit">%</span></strong><span>Отличный результат</span></div></div><div class="delivery-legend"><div class="delivery-line"><i class="legend-dot"></i>Доставлено<strong>67 188</strong></div><div class="delivery-line"><i class="legend-dot purple"></i>В обработке<strong>821</strong></div><div class="delivery-line"><i class="legend-dot" style="background:#e8d5b1"></i>Не доставлено<strong>411</strong></div></div></div></section>`;
}
function filteredCampaigns() {
  return campaigns.filter(
    (c) =>
      (filter === "all" ||
        (filter === "active"
          ? ["running", "paused", "scheduled"].includes(c.status)
          : c.status === filter)) &&
      `${c.name} ${c.subject} ${c.segment}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
}
function campaignTable() {
  const rows = filteredCampaigns();
  const max = Math.max(1, Math.ceil(rows.length / 5));
  currentPage = Math.min(currentPage, max);
  const slice = rows.slice((currentPage - 1) * 5, currentPage * 5);
  return `<div class="table-scroll"><table><thead><tr><th>Название рассылки</th><th>Статус</th><th>Получатели</th><th>Прогресс</th><th>Открытия</th><th>Дата</th><th><span class="sr-only">Действия</span></th></tr></thead><tbody>${slice.length ? slice.map((c) => `<tr><td><button class="campaign-name" data-detail="${esc(c.id)}"><span class="mail-tile ${esc(c.color)}">${icon("mail")}</span><span style="text-align:left"><strong>${esc(c.name)}</strong><small>${esc(c.segment)}</small></span></button></td><td>${badge(c.status)}</td><td>${num(c.total)}</td><td><span class="progress-cell"><strong>${c.total ? Math.round((c.sent / c.total) * 100) : 0}%</strong><span class="mini-progress"><span style="width:${c.total ? Math.min(100, (c.sent / c.total) * 100) : 0}%"></span></span></span></td><td>${c.sent ? c.opens.toLocaleString("ru-RU") + "%" : "—"}</td><td>${date(c.date).replace(" 2026 г.", "")}</td><td><button class="icon-button table-more" data-detail="${esc(c.id)}" aria-label="Открыть рассылку ${esc(c.name)}">${icon("more")}</button></td></tr>`).join("") : `<tr><td colspan="7"><div class="empty">${icon("search")}Рассылки не найдены<p>Попробуйте изменить запрос или создайте новую рассылку.</p></div></td></tr>`}</tbody></table></div><div class="table-footer"><span>${rows.length ? `Показано ${(currentPage - 1) * 5 + 1}–${Math.min(currentPage * 5, rows.length)} из ${rows.length} рассылок` : "Нет рассылок"}</span><div class="pagination"><button data-paginate="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""} aria-label="Предыдущая страница">${icon("left")}</button><button class="current" aria-current="page">${currentPage}</button><button data-paginate="${currentPage + 1}" ${currentPage === max ? "disabled" : ""} aria-label="Следующая страница">${icon("right")}</button></div></div>`;
}
function campaignPanel() {
  return `<section class="panel campaign-panel"><div class="panel-heading"><h2>${page === "overview" ? "Последние рассылки" : "Все рассылки"}</h2>${page === "overview" ? button("Все рассылки", null, "go-campaigns", "text") : button("Экспорт CSV", "download", "export", "text")}</div><div class="campaign-controls"><div class="tabs" role="group" aria-label="Фильтр рассылок">${[
    ["all", "Все рассылки"],
    ["active", "Активные"],
    ["done", "Завершённые"],
    ["draft", "Черновики"],
  ]
    .map(
      ([f, label]) =>
        `<button class="tab ${filter === f ? "active" : ""}" data-filter="${f}" aria-pressed="${filter === f}">${label}${f === "all" ? `<span>${campaigns.length}</span>` : ""}</button>`,
    )
    .join(
      "",
    )}</div><label class="search">${icon("search")}<input id="campaign-search" placeholder="Найти рассылку..." aria-label="Найти рассылку" value="${esc(query)}"/></label></div><div id="campaign-table">${campaignTable()}</div></section>`;
}
function overview() {
  return (
    heading(
      "Всё начинается с сообщения",
      "Ваши рассылки, аудитория и результаты — в одном месте.",
      button("14–20 ноября 2026", "calendar", "date") +
        button("Создать рассылку", "plus", "create", "primary"),
    ) +
    `<section class="launch-banner"><div class="banner-copy"><div class="eyebrow">БОЛЬШЕ ОХВАТ. БЛИЖЕ К АУДИТОРИИ.</div><h2>Большие рассылки. Легко.</h2><p>Всё готово для вашего следующего большого запуска.</p></div><div class="banner-side"><div class="banner-mail">${icon("send")}</div><div class="banner-volume"><strong>92 000</strong><span>сообщений в вашем плане</span></div></div></section>` +
    metrics() +
    `<div class="content-grid" id="overview-charts">${chart()}${delivery()}</div>` +
    campaignPanel() +
    `<div class="bottom-note">${icon("shield")}Ваши идеи заслуживают быть услышанными. Мы поможем им добраться до адресата.</div>`
  );
}
function audience() {
  return (
    heading(
      "Ваша аудитория",
      "Люди, с которыми вы остаётесь на связи.",
      button("Скачать пример CSV", "download", "sample") +
        button("Импортировать CSV", "upload", "import", "primary"),
      "КОНТАКТЫ И СЕГМЕНТЫ",
    ) +
    `<div class="metrics"><article class="metric"><div class="metric-label">Импортированные контакты<span class="metric-icon">${icon("users")}</span></div><div class="metric-value">${num(contacts.length)}</div><div class="metric-bottom">В локальной базе этого браузера</div></article><article class="metric"><div class="metric-label">Уникальные email<span class="metric-icon">${icon("mail")}</span></div><div class="metric-value">${num(new Set(contacts.map((c) => c.email)).size)}</div><div class="metric-bottom">Без повторяющихся адресов</div></article><article class="metric"><div class="metric-label">Демо-аудитория<span class="metric-icon">${icon("users")}</span></div><div class="metric-value">92 000</div><div class="metric-bottom">Иллюстрация масштаба системы</div></article><article class="metric"><div class="metric-label">Формат импорта<span class="metric-icon">${icon("file")}</span></div><div class="metric-value">CSV</div><div class="metric-bottom">Поля: email, name, segment</div></article></div><section class="panel campaign-panel"><div class="toolbar"><label class="search">${icon("search")}<input id="contact-search" placeholder="Email, имя или сегмент" aria-label="Поиск контактов" value="${esc(contactQuery)}"/></label>${button("Экспорт контактов", "download", "export-contacts")}</div><div id="contact-table">${contactTable()}</div></section><div class="info-box">Импортированные контакты хранятся только в этом браузере. Демо-аудитория не содержит реальных адресов. Для общей базы команды потребуется подключение сервера.</div>`
  );
}
function contactTable() {
  const filtered = contacts.filter((c) =>
    `${c.email} ${c.name} ${c.segment}`
      .toLowerCase()
      .includes(contactQuery.toLowerCase()),
  );
  return filtered.length
    ? `<div class="table-scroll"><table><thead><tr><th>Имя</th><th>Email</th><th>Сегмент</th><th>Статус</th></tr></thead><tbody>${filtered
        .slice(0, 100)
        .map(
          (c) =>
            `<tr><td>${esc(c.name || "Без имени")}</td><td>${esc(c.email)}</td><td>${esc(c.segment || "Без сегмента")}</td><td><span class="badge done">Импортирован</span></td></tr>`,
        )
        .join(
          "",
        )}</tbody></table></div><div class="table-footer">Показано ${Math.min(filtered.length, 100)} из ${num(filtered.length)} контактов</div>`
    : `<div class="empty">${icon("users")}${contactQuery ? "Контакты не найдены" : "Познакомимся с вашей аудиторией"}<p>${contactQuery ? "Попробуйте другой поисковый запрос." : "Импортируйте CSV-файл с email-адресами, чтобы создать первую базу."}</p>${!contactQuery ? `<div style="margin-top:20px">${button("Импортировать контакты", "upload", "import", "primary")}</div>` : ""}</div>`;
}
const templates = [
  {
    name: "Новости и дайджест",
    description:
      "Главные новости и полезные материалы в одном аккуратном письме.",
    title: "Самое важное —\nдля вас",
    color: "#edf3e5",
    subject: "Главные новости этого месяца",
    body: "Здравствуйте, {{name}}!\n\nДелимся важными новостями и полезными материалами.\n\nДобавьте сюда новости вашей компании.\n\nС теплом, команда Nalog Project",
  },
  {
    name: "Сервисное уведомление",
    description: "Важные обновления сервиса. Просто, понятно и по делу.",
    title: "Стало ещё\nудобнее",
    color: "#f0edf7",
    subject: "Важное обновление сервиса",
    body: "Здравствуйте, {{name}}!\n\nУ нас есть важное обновление для вас.\n\nОпишите изменение и необходимые действия.\n\nКоманда Nalog Project",
  },
  {
    name: "Приветственное письмо",
    description: "Тёплое знакомство и первые шаги для новых подписчиков.",
    title: "Рады, что\nвы с нами.",
    color: "#f6f0e6",
    subject: "Добро пожаловать!",
    body: "Здравствуйте, {{name}}!\n\nРады приветствовать вас! Благодарим за регистрацию.\n\nРасскажите о следующих шагах для нового пользователя.\n\nКоманда Nalog Project",
  },
];
function templatePage() {
  return (
    heading(
      "Хорошие письма начинаются здесь",
      "Выберите основу и добавьте то, что важно вашей аудитории.",
      button("Пустое письмо", "plus", "create", "primary"),
      "БИБЛИОТЕКА ШАБЛОНОВ",
    ) +
    `<div class="section-grid">${templates.map((t, i) => `<article class="panel template"><div class="template-preview" style="background:${t.color}"><div class="template-sheet"><div class="mini-brand">nalog<span style="color:#99bb6d">.</span></div><div class="mini-title">${esc(t.title).replace("\n", "<br>")}</div><div class="mini-line"></div><div class="mini-line" style="width:80%"></div><div class="mini-button"></div></div></div><h3>${t.name}</h3><p>${t.description}</p><button class="button" data-template="${i}">${icon("copy")}Использовать шаблон</button></article>`).join("")}</div>`
  );
}
function analytics() {
  return (
    heading(
      "За цифрами — живой отклик",
      "Демонстрационные показатели за 14–20 ноября 2026.",
      button("Выгрузить отчёт", "download", "export", "primary"),
      "АНАЛИТИКА РАССЫЛОК",
    ) +
    metrics() +
    `<div class="content-grid" id="overview-charts">${chart()}${delivery()}</div><div class="analytics-grid"><section class="panel"><div class="panel-heading"><h2>Открываемость по кампаниям</h2></div><div class="bar-chart">${campaigns
      .filter((c) => c.sent)
      .map(
        (c) =>
          `<div><div class="bar-label"><span>${esc(c.name)}</span><strong>${c.opens.toLocaleString("ru-RU")}%</strong></div><div class="bar-track"><span style="width:${c.opens}%"></span></div></div>`,
      )
      .join(
        "",
      )}</div></section><section class="panel"><div class="panel-heading"><h2>Путь сообщения</h2></div><div class="bar-chart">${[
      ["Отправлено", 68420, 100],
      ["Доставлено", 67188, 98.2],
      ["Открыто", 28756, 42.8],
      ["Перешли по ссылке", 4300, 6.4],
    ]
      .map(
        ([name, n, w]) =>
          `<div><div class="bar-label"><span>${name}</span><strong>${num(n)}</strong></div><div class="bar-track"><span style="width:${w}%;background:#${w > 50 ? "b5d495" : "c1b4df"}"></span></div></div>`,
      )
      .join("")}</div></section></div>`
  );
}
function settingsPage() {
  return (
    heading(
      "Настроено под вас",
      "Параметры рабочего пространства и отправителя.",
      "",
      "НАСТРОЙКИ",
    ) +
    `<form id="settings-form" class="panel settings-panel"><h2>Рабочее пространство</h2><div class="field"><label for="workspace-name">Название пространства</label><input id="workspace-name" name="workspace" value="${esc(settings.workspace)}" maxlength="60" required/></div><div class="form-grid"><div class="field"><label for="sender-name">Имя отправителя</label><input id="sender-name" name="sender" value="${esc(settings.sender)}" required maxlength="80"/></div><div class="field"><label for="sender-email">Email отправителя</label><input id="sender-email" name="email" type="email" value="${esc(settings.email)}" required/></div><div class="field"><label for="reply-email">Адрес для ответов</label><input id="reply-email" name="reply" type="email" value="${esc(settings.reply)}" required/></div><div class="field"><label for="timezone">Часовой пояс</label><select id="timezone" name="timezone">${[
      ["Asia/Almaty", "Алматы · UTC+5"],
      ["Europe/Moscow", "Москва · UTC+3"],
      ["UTC", "UTC · UTC+0"],
    ]
      .map(
        ([v, l]) =>
          `<option value="${v}" ${settings.timezone === v ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></div></div><div class="info-box">Настройки сохраняются локально. Почтовый провайдер не подключён. Для реальной отправки потребуется настроить сервер, домен отправителя и обработку статусов доставки.</div><button type="submit" class="button primary">${icon("check")}Сохранить изменения</button></form><section class="panel settings-panel"><h2>Демонстрационные данные</h2><p style="font-size:13px;color:#849476;line-height:1.8">Можно восстановить исходные примеры рассылок. Импортированные контакты и настройки сохранятся.</p>${button("Восстановить примеры", null, "reset", "danger-button")}</section>`
  );
}
function render() {
  const nav = navigation.find((n) => n[0] === page);
  $("#navigation").innerHTML = navigation
    .map(
      ([id, ic, label]) =>
        `<a href="#${id}" class="nav-item ${page === id ? "active" : ""}" ${page === id ? 'aria-current="page"' : ""}>${icon(ic)}<span>${label}</span>${id === "campaigns" ? `<span class="nav-count">${campaigns.length}</span>` : ""}</a>`,
    )
    .join("");
  $("#breadcrumb-page").textContent = nav[2];
  document.title = `${nav[2]} · Pulse`;
  $("#main").innerHTML =
    page === "overview"
      ? overview()
      : page === "campaigns"
        ? heading(
            "Каждое сообщение — по делу",
            "Создавайте кампании и управляйте всем циклом рассылки.",
            button("Создать рассылку", "plus", "create", "primary"),
            "УПРАВЛЕНИЕ РАССЫЛКАМИ",
          ) + campaignPanel()
        : page === "audience"
          ? audience()
          : page === "templates"
            ? templatePage()
            : page === "analytics"
              ? analytics()
              : settingsPage();
  updateWorkspace();
}
function updateWorkspace() {
  $(".workspace strong").textContent = settings.workspace;
  $(".breadcrumb>span").textContent = settings.workspace;
}
function navigate() {
  page = navigation.some((n) => n[0] === location.hash.slice(1))
    ? location.hash.slice(1)
    : "overview";
  filter = "all";
  query = "";
  currentPage = 1;
  $("#sidebar").classList.remove("open");
  render();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", navigate);
function modal(title, body, footer = "") {
  const dialog = $("#dialog");
  if (dialog.open) dialog.close();
  $("#dialog-content").innerHTML =
    `<div class="dialog-header"><h2>${title}</h2><button class="icon-button" data-action="close" aria-label="Закрыть">${icon("close")}</button></div><div class="dialog-body">${body}</div>${footer ? `<div class="dialog-footer">${footer}</div>` : ""}`;
  dialog.showModal();
}
$("#dialog").addEventListener("click", (e) => {
  if (e.target === $("#dialog")) {
    const r = e.target.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      e.target.close();
  }
});
function createCampaign(template = null, existing = null) {
  const item = existing || template || {};
  modal(
    existing ? "Редактировать рассылку" : "Новая рассылка",
    `<p>Хорошее письмо начинается с понятной цели. Заполните детали и сохраните черновик.</p><form id="campaign-form" data-edit="${esc(existing?.id || "")}"><div class="field"><label for="campaign-name">Название рассылки</label><input id="campaign-name" name="name" placeholder="Например, новости за декабрь" value="${esc(item.name || "")}" maxlength="100" required/></div><div class="field"><label for="campaign-subject">Тема письма</label><input id="campaign-subject" name="subject" placeholder="То, что получатель увидит первым" value="${esc(item.subject || "")}" maxlength="150" required/></div><div class="form-grid"><div class="field"><label for="campaign-segment">Аудитория</label><select name="segment" id="campaign-segment">${["Все подписчики", "Активные пользователи", "Клиенты с подпиской", "Новые подписчики", ...(contacts.length ? ["Импортированные контакты"] : [])].map((s) => `<option ${item.segment === s ? "selected" : ""}>${s}</option>`).join("")}</select></div><div class="field"><label for="campaign-total">Количество получателей</label><input id="campaign-total" name="total" type="number" min="1" max="92000" value="${Number(item.total) || 24500}" required/><small>До 92 000 сообщений за кампанию</small></div></div><div class="field" style="margin-top:17px"><label for="campaign-body">Текст письма</label><textarea id="campaign-body" name="body" placeholder="Здравствуйте, {{name}}!" required maxlength="20000">${esc(item.body || "")}</textarea><small>Используйте {{name}}, чтобы персонализировать обращение.</small></div><div class="info-box">Черновик сохранится в этом браузере. Отправка станет доступна после подключения почтового сервиса.</div></form>`,
    button("Отмена", null, "close") +
      `<button type="submit" form="campaign-form" class="button primary">${icon("check")}Сохранить черновик</button>`,
  );
}
function detail(id) {
  const c = campaigns.find((c) => c.id === id);
  if (!c) return;
  modal(
    esc(c.name),
    `${badge(c.status)}<div class="detail-grid"><div><strong>${num(c.total)}</strong><small>получателей</small></div><div><strong>${num(c.sent)}</strong><small>отправлено</small></div><div><strong>${c.sent ? c.opens.toLocaleString("ru-RU") + "%" : "—"}</strong><small>открываемость</small></div></div><div class="field"><label>Аудитория</label><span style="font-size:13px">${esc(c.segment)}</span></div><div class="preview-email"><div class="preview-subject">${esc(c.subject)}</div>${esc(c.body)}</div><div class="info-box">${c.status === "draft" ? "Это локальный черновик. Реальные письма не отправляются." : "Демонстрационная кампания. Показатели и статусы используются для знакомства с интерфейсом."}</div>`,
    `<button class="button" data-duplicate="${esc(c.id)}">${icon("copy")}Копировать</button>${c.status === "draft" ? `<button class="button primary" data-edit="${esc(c.id)}">Редактировать</button>` : ["running", "paused"].includes(c.status) ? `<button class="button primary" data-toggle="${esc(c.id)}">${icon(c.status === "running" ? "pause" : "play")}${c.status === "running" ? "Приостановить" : "Продолжить"} демо</button>` : ""}`,
  );
}
function download(filename, rows) {
  const value = (v) => {
    let s = String(v ?? "");
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const csv = "\uFEFF" + rows.map((r) => r.map(value).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function parseCsv(text) {
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/, 1)[0];
  const delimiter =
    (first.match(/;/g) || []).length > (first.match(/,/g) || []).length
      ? ";"
      : ",";
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("В CSV не закрыты кавычки. Проверьте формат файла.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
let pendingContacts = [];
function importModal() {
  pendingContacts = [];
  modal(
    "Импорт аудитории",
    `<p>Загрузите CSV с заголовками <strong>email</strong>, <strong>name</strong> и <strong>segment</strong>. Обязателен только email.</p><div class="upload-area">${icon("upload")}<strong style="font-size:14px">Ваши контакты — в одном месте</strong><p>CSV до 5 МБ · не более 92 000 контактов<br>Поддерживаются запятые и точки с запятой.</p><input type="file" id="csv-file" accept=".csv,text/csv" aria-label="Выберите CSV-файл"/></div><div id="import-result" class="import-result" aria-live="polite"></div><div class="info-box">Импортируйте контакты, которые дали согласие на получение ваших писем. Файл обрабатывается в браузере.</div>`,
    button("Скачать пример", null, "sample") +
      `<button class="button primary" data-action="confirm-import" disabled id="confirm-import">Импортировать</button>`,
  );
}
async function prepareImport(file) {
  pendingContacts = [];
  $("#confirm-import").disabled = true;
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    $("#import-result").textContent =
      "Файл больше 5 МБ. Разделите базу на несколько файлов.";
    return;
  }
  try {
    const rows = parseCsv(await file.text());
    const headers = (rows.shift() || []).map((h) => h.toLowerCase());
    const emailIndex = headers.indexOf("email"),
      nameIndex = headers.indexOf("name"),
      segmentIndex = headers.indexOf("segment");
    if (emailIndex < 0)
      throw Error(
        "Не найден столбец email. Скачайте пример CSV и проверьте заголовки.",
      );
    let invalid = 0,
      duplicates = 0;
    const known = new Set(contacts.map((c) => c.email.toLowerCase()));
    for (const r of rows) {
      const email = (r[emailIndex] || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        invalid++;
        continue;
      }
      if (known.has(email)) {
        duplicates++;
        continue;
      }
      known.add(email);
      pendingContacts.push({
        email,
        name: r[nameIndex] || "",
        segment: r[segmentIndex] || "Импорт CSV",
      });
    }
    if (contacts.length + pendingContacts.length > 92000)
      throw Error(
        "Общее количество контактов превышает 92 000. Уменьшите файл.",
      );
    $("#import-result").textContent =
      `Готово к импорту: ${num(pendingContacts.length)}. Повторы: ${num(duplicates)}. Некорректные адреса: ${num(invalid)}.`;
    $("#confirm-import").disabled = !pendingContacts.length;
  } catch (e) {
    pendingContacts = [];
    $("#import-result").textContent = e.message;
  }
}
function dateModal() {
  modal(
    "Период отчёта",
    `<p>В демопространстве доступен пример данных за ноябрь 2026. Переключите период графика, чтобы изучить динамику.</p><div class="segmented" style="justify-content:center;padding:8px"><button data-period="week" class="${period === "week" ? "selected" : ""}" style="font-size:14px;padding:12px">14–20 ноября</button><button data-period="month" class="${period === "month" ? "selected" : ""}" style="font-size:14px;padding:12px">Ноябрь целиком</button></div>`,
    button("Готово", null, "close", "primary"),
  );
}
const actions = {
  create: () => createCampaign(),
  close: () => $("#dialog").close(),
  "go-campaigns": () => (location.hash = "campaigns"),
  date: dateModal,
  export: () => {
    download("pulse-campaigns.csv", [
      [
        "Название",
        "Статус",
        "Аудитория",
        "Получатели",
        "Отправлено",
        "Открытия %",
        "Переходы %",
        "Дата",
      ],
      ...filteredCampaigns().map((c) => [
        c.name,
        statuses[c.status][0],
        c.segment,
        c.total,
        c.sent,
        c.opens,
        c.clicks,
        c.date,
      ]),
    ]);
    toast("Отчёт по кампаниям скачан");
  },
  "export-contacts": () => {
    if (!contacts.length) return toast("Сначала импортируйте контакты");
    download("pulse-contacts.csv", [
      ["email", "name", "segment"],
      ...contacts.map((c) => [c.email, c.name, c.segment]),
    ]);
    toast("Контакты экспортированы");
  },
  sample: () =>
    download("pulse-contacts-example.csv", [
      ["email", "name", "segment"],
      ["anna@example.com", "Анна", "Клиенты"],
      ["alex@example.com", "Алексей", "Подписчики"],
    ]),
  import: importModal,
  "confirm-import": () => {
    if (!pendingContacts.length) return;
    const next = [...contacts, ...pendingContacts];
    if (!persist("pulse.contacts.v1", next)) return;
    const count = pendingContacts.length;
    contacts = next;
    pendingContacts = [];
    $("#dialog").close();
    render();
    toast(`Импортировано контактов: ${num(count)}`);
  },
  reset: () =>
    modal(
      "Восстановить примеры?",
      `<p>Все текущие кампании, включая созданные черновики, будут заменены исходными демонстрационными примерами. Контакты и настройки сохранятся.</p>`,
      button("Отмена", null, "close") +
        button("Восстановить", null, "confirm-reset", "primary"),
    ),
  "confirm-reset": () => {
    const next = structuredClone(seed);
    if (!persist("pulse.campaigns.v1", next)) return;
    campaigns = next;
    $("#dialog").close();
    render();
    toast("Демонстрационные кампании восстановлены");
  },
};
document.addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]");
  if (action) {
    actions[action.dataset.action]?.();
    return;
  }
  const f = e.target.closest("[data-filter]");
  if (f) {
    filter = f.dataset.filter;
    currentPage = 1;
    render();
    return;
  }
  const p = e.target.closest("[data-period]");
  if (p) {
    period = p.dataset.period;
    const charts = $("#overview-charts");
    if (charts) charts.innerHTML = chart() + delivery();
    if ($("#dialog").open) dateModal();
    return;
  }
  const detailButton = e.target.closest("[data-detail]");
  if (detailButton) {
    detail(detailButton.dataset.detail);
    return;
  }
  const pagination = e.target.closest("[data-paginate]");
  if (pagination) {
    currentPage = Number(pagination.dataset.paginate);
    $("#campaign-table").innerHTML = campaignTable();
    return;
  }
  const template = e.target.closest("[data-template]");
  if (template) {
    createCampaign(templates[Number(template.dataset.template)]);
    return;
  }
  const edit = e.target.closest("[data-edit]");
  if (edit && edit.tagName === "BUTTON") {
    createCampaign(
      null,
      campaigns.find((c) => c.id === edit.dataset.edit),
    );
    return;
  }
  const duplicate = e.target.closest("[data-duplicate]");
  if (duplicate) {
    const c = campaigns.find((c) => c.id === duplicate.dataset.duplicate);
    createCampaign({
      ...c,
      name: c.name + " — копия",
      sent: 0,
      status: "draft",
    });
    return;
  }
  const toggle = e.target.closest("[data-toggle]");
  if (toggle) {
    const c = campaigns.find((c) => c.id === toggle.dataset.toggle);
    const old = c.status;
    c.status = c.status === "running" ? "paused" : "running";
    if (!saveCampaigns()) {
      c.status = old;
      return;
    }
    detail(c.id);
    render();
    toast(
      c.status === "paused"
        ? "Демо-кампания поставлена на паузу"
        : "Демо-кампания продолжена",
    );
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "campaign-search") {
    query = e.target.value;
    currentPage = 1;
    $("#campaign-table").innerHTML = campaignTable();
  }
  if (e.target.id === "contact-search") {
    contactQuery = e.target.value;
    $("#contact-table").innerHTML = contactTable();
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "csv-file") prepareImport(e.target.files[0]);
  if (
    e.target.id === "campaign-segment" &&
    e.target.value === "Импортированные контакты"
  )
    $("#campaign-total").value = contacts.length;
});
document.addEventListener("submit", (e) => {
  if (e.target.id === "campaign-form") {
    e.preventDefault();
    const form = e.target,
      data = Object.fromEntries(new FormData(form));
    if (
      data.segment === "Импортированные контакты" &&
      Number(data.total) > contacts.length
    ) {
      $("#campaign-total").setCustomValidity(
        `В базе только ${contacts.length} контактов`,
      );
      $("#campaign-total").reportValidity();
      $("#campaign-total").addEventListener(
        "input",
        () => $("#campaign-total").setCustomValidity(""),
        { once: true },
      );
      return;
    }
    const id = form.dataset.edit;
    const campaign = {
      id: id || crypto.randomUUID(),
      name: data.name.trim(),
      subject: data.subject.trim(),
      segment: data.segment,
      total: Number(data.total),
      body: data.body.trim(),
      sent: 0,
      opens: 0,
      clicks: 0,
      status: "draft",
      date: new Date().toISOString(),
      color: "lilac",
    };
    if (!campaign.name || !campaign.subject || !campaign.body)
      return toast("Заполните название, тему и текст письма");
    const next = id
      ? campaigns.map((c) => (c.id === id ? campaign : c))
      : [campaign, ...campaigns];
    if (!persist("pulse.campaigns.v1", next)) return;
    campaigns = next;
    $("#dialog").close();
    filter = "draft";
    query = "";
    currentPage = 1;
    if (page !== "campaigns") {
      location.hash = "campaigns";
    } else render();
    toast(id ? "Изменения сохранены" : "Черновик создан");
  }
  if (e.target.id === "settings-form") {
    e.preventDefault();
    const next = Object.fromEntries(new FormData(e.target));
    if (!next.workspace.trim() || !next.sender.trim())
      return toast("Введите название пространства и имя отправителя");
    if (!persist("pulse.settings.v1", next)) return;
    settings = next;
    updateWorkspace();
    toast("Настройки сохранены");
  }
});
$("#mobile-menu").onclick = () => $("#sidebar").classList.toggle("open");
$("#scrim").onclick = () => $("#sidebar").classList.remove("open");
for (const id of ["workspace", "profile", "account"])
  $("#" + id).onclick = () => {
    location.hash = "settings";
  };
$("#help").onclick = () =>
  modal(
    "Ваш первый запуск в Pulse",
    `<div class="notification-list">${[
      [
        "users",
        "1. Добавьте аудиторию",
        "Откройте «Аудитория», скачайте пример и импортируйте CSV с адресами.",
      ],
      [
        "template",
        "2. Подготовьте письмо",
        "Выберите шаблон или создайте свою рассылку. Сохраните её в черновики.",
      ],
      [
        "chart",
        "3. Изучите результаты",
        "Посмотрите пример статистики: доставку, открытия и переходы.",
      ],
    ]
      .map(
        ([ic, title, text]) =>
          `<div class="notification-item"><span class="mail-tile">${icon(ic)}</span><div><strong>${title}</strong><p>${text}</p></div></div>`,
      )
      .join(
        "",
      )}</div><div class="info-box">Это фронтенд-прототип. Реальная отправка, синхронизация команды и статистика появятся после подключения backend API и почтового провайдера.</div>`,
    button("Понятно", null, "close", "primary"),
  );
$("#notifications").onclick = () =>
  modal(
    "Уведомления",
    `<div class="notification-list"><div class="notification-item"><span class="mail-tile">${icon("checkCircle")}</span><div><strong>Рабочее пространство готово</strong><p>Изучите демо-кампании или создайте первую собственную рассылку.</p><small>Демонстрационное уведомление</small></div></div><div class="notification-item"><span class="mail-tile lilac">${icon("shield")}</span><div><strong>Ваши черновики сохраняются</strong><p>Локальные изменения доступны после перезагрузки страницы в этом браузере.</p></div></div></div>`,
    button("Закрыть", null, "close", "primary"),
  );
navigate();
