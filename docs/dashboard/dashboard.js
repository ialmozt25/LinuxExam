"use strict";

// Монтирование: main#dashboard и строка обновления в header.
const mount = document.getElementById("dashboard");
const lastUpdate = document.getElementById("last-update");

// Таймстемп последнего успешного обновления (0 = ещё не обновлялся).
let lastUpdateTs = 0;

// Утилита: создать узел с классом и текстом (только createElement/textContent).
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asText(value, fallback) {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

// Ошибка загрузки показывается вместо модулей.
function showError(e) {
  mount.textContent = "state.json недоступен: " + e.message;
}

async function loadState() {
  try {
    const r = await fetch("./state.json");
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } catch (e) {
    // Ошибка не стирает уже отрисованные данные: текст идёт в строку обновления.
    if (lastUpdate) lastUpdate.textContent = "ошибка: " + e.message;
    if (lastUpdateTs === 0) showError(e);
    return null;
  }
}

// Карточка-модуль: section.card + заголовок.
function card(titleText) {
  const section = document.createElement("section");
  section.classList.add("card");
  section.appendChild(el("h2", "section-title", titleText));
  return section;
}

// Модуль 1: прогресс к цели (current/target + процент из state).
function progressModule(state) {
  const c = card("Прогресс к цели");
  const goal = state.goal || {};
  const track = el("div", "progress");
  const bar = document.createElement("div");
  bar.className = "progress-bar";
  const pct = typeof goal.progress_percent === "number"
    ? goal.progress_percent
    : Math.round((Number(goal.current_questions) / Number(goal.target_questions)) * 1000) / 10;
  bar.style.width = pct + "%";
  track.appendChild(bar);
  const meta = el("div", "progress-meta");
  meta.appendChild(el("span", null, asText(goal.current_questions, "?") + " / " + asText(goal.target_questions, "?")));
  meta.appendChild(el("span", null, asText(pct, "?") + "%"));
  c.appendChild(track);
  c.appendChild(meta);
  return c;
}

// Модуль 2: milestones со статусными классами.
function milestonesModule(state) {
  const c = card("Milestones");
  const list = el("div", "milestone-list");
  for (const m of asArray(state.milestones)) {
    const row = el("div", "milestone-row status-" + m.status);
    row.appendChild(el("span", "milestone-id", m.id));
    row.appendChild(el("span", "milestone-title", m.title));
    row.appendChild(el("span", "milestone-count", asText(m.commit, "")));
    list.appendChild(row);
  }
  c.appendChild(list);
  return c;
}

// Подпись гейта: числа берутся только из state.
function gateLabel(name, g) {
  if (name === "qc" && typeof g.total === "number") {
    return "qc: " + g.status + " (" + g.total + " вопросов, " + g.fails + " fail)";
  }
  if (name === "vitest" && typeof g.tests_total === "number") {
    return "vitest: " + g.status + " (" + g.tests_passed + "/" + g.tests_total + ")";
  }
  return name + ": " + g.status;
}

// Модуль 3: гейты.
function gatesModule(state) {
  const c = card("Гейты");
  const list = el("div", "gate-list");
  const gates = state.gates || {};
  for (const name of Object.keys(gates)) {
    const g = gates[name] || {};
    const modifier = g.status === "pass" ? "pass" : "fail";
    const badge = el("span", "gate-badge gate-badge--" + modifier);
    badge.textContent = gateLabel(name, g);
    list.appendChild(badge);
  }
  c.appendChild(list);
  return c;
}

// Модуль 4: открытые проблемы.
function issuesModule(state) {
  const c = card("Открытые проблемы");
  const list = el("div", "issue-list");
  const issues = asArray(state.issues_open);
  if (issues.length === 0) {
    list.appendChild(el("p", "issue-note", "Открытых проблем нет"));
  }
  for (const i of issues) {
    const row = el("div", "issue-row");
    row.appendChild(el("span", "issue-severity", i.severity));
    row.appendChild(el("span", "issue-note", i.id + " — " + i.note));
    list.appendChild(row);
  }
  c.appendChild(list);
  return c;
}

// Рендер: ровно 4 модуля-карточки. Идемпотентен: повторный вызов заменяет
// содержимое, а не дописывает карточки (иначе auto-refresh дублировал бы их).
function render(state) {
  mount.replaceChildren();
  if (lastUpdate && state.last_update) lastUpdate.textContent = state.last_update;
  mount.appendChild(progressModule(state));
  mount.appendChild(milestonesModule(state));
  mount.appendChild(gatesModule(state));
  mount.appendChild(issuesModule(state));
}

// Обновление по успешной загрузке: таймстемп + перерисовка.
function renderIfOk(s) {
  if (s !== null && s !== undefined) {
    lastUpdateTs = Date.now();
    render(s);
  }
}

// Счётчик «N сек назад» (0 = ещё не обновлялся).
setInterval(() => {
  const el = document.getElementById("last-updated-ago");
  if (!el) return;
  if (lastUpdateTs === 0) {
    el.textContent = "—";
    return;
  }
  el.textContent = Math.floor((Date.now() - lastUpdateTs) / 1000) + " сек назад";
}, 1000);

// Ручное обновление кнопкой.
const refreshBtn = document.getElementById("refresh-btn");
if (refreshBtn) {
  refreshBtn.addEventListener("click", () => {
    loadState().then(renderIfOk);
  });
}

// Автообновление раз в 30 секунд; в скрытой вкладке не выполняется.
setInterval(() => {
  if (document.hidden) return;
  loadState().then(renderIfOk);
}, 30000);

async function init() {
  renderIfOk(await loadState());
}

init();
