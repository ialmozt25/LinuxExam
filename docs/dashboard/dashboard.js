"use strict";

// Монтирование: main#dashboard и строка обновления в header.
const mount = document.getElementById("dashboard");
const lastUpdate = document.getElementById("last-update");

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
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } catch (e) {
    showError(e);
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

// Рендер: ровно 4 модуля-карточки.
function render(state) {
  mount.appendChild(progressModule(state));
  mount.appendChild(milestonesModule(state));
  mount.appendChild(gatesModule(state));
  mount.appendChild(issuesModule(state));
}

async function init() {
  const state = await loadState();
  if (!state) return;
  if (state.last_update) lastUpdate.textContent = state.last_update;
  render(state);
}

init();
