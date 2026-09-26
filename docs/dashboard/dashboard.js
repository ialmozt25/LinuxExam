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

// Относительное время: с временем — минуты/часы, без времени (YYYY-MM-DD) — дни.
function relativeTime(iso) {
  if (!iso) return "—";
  const hasTime = /\dT\d/.test(iso);
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 0) return "сейчас";
  if (hasTime) {
    if (s < 60) return "только что";
    if (s < 3600) return Math.floor(s / 60) + " мин назад";
    if (s < 86400) return Math.floor(s / 3600) + " ч назад";
  }
  const days = Math.floor(s / 86400);
  if (days === 0) return "сегодня";
  if (days === 1) return "вчера";
  return days + " дн назад";
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

// Рендер V2: KPI-row + focus-row + свёрнутые details. Идемпотентен: повторный
// вызов заменяет содержимое, но сохраняет состояние открытости <details>.
function render(state) {
  // Состояние <details> предыдущего рендера (auto-refresh не должен схлопывать).
  const prevMil = document.getElementById("details-milestones");
  const prevAct = document.getElementById("details-activity");
  const openMil = !!(prevMil && prevMil.open);
  const openAct = !!(prevAct && prevAct.open);

  mount.replaceChildren();

  // Защита от undefined в state.
  const goal = state.goal || {};
  const ms = asArray(state.milestones);
  const issues = asArray(state.issues_open);
  const commits = asArray(state.recent_commits);
  const gates = state.gates || {};

  // KPI-ROW
  const kpiRow = el("section", "kpi-row");

  // KPI 1: Банк
  const k1 = el("div", "kpi");
  k1.appendChild(el("div", "kpi__label", "Банк"));
  k1.appendChild(el("div", "kpi__value mono",
    asText(goal.current_questions, "—") + " / " + asText(goal.target_questions, "—")));
  const bar = el("div", "progress__bar");
  const fill = el("div", "progress__fill");
  fill.style.width = (goal.progress_percent || 0) + "%";
  bar.appendChild(fill);
  k1.appendChild(bar);
  const pctTxt = typeof goal.progress_percent === "number"
    ? goal.progress_percent + "%" : "—";
  k1.appendChild(el("div", "kpi__sub", pctTxt));
  kpiRow.appendChild(k1);

  // KPI 2: Фаза — последний completed milestone.
  let lastIdx = -1;
  for (let i = 0; i < ms.length; i += 1) {
    if (ms[i].status === "completed") lastIdx = i;
  }
  const lastCompleted = lastIdx >= 0 ? ms[lastIdx] : null;

  const k2 = el("div", "kpi");
  k2.appendChild(el("div", "kpi__label", "Фаза"));
  const k2value = lastCompleted
    ? lastCompleted.id + " · " + asText(lastCompleted.title, "").slice(0, 40)
    : "—";
  k2.appendChild(el("div", "kpi__value mono", k2value));
  k2.appendChild(el("div", "kpi__sub", lastCompleted ? "завершён" : "—"));
  kpiRow.appendChild(k2);

  // KPI 3: Темп — локальная дата (не UTC).
  const d = new Date();
  const today = d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
  const featToday = commits.filter(function (c) {
    return c.date === today && asText(c.message, "").startsWith("feat(bank)");
  }).length;

  const k3 = el("div", "kpi");
  k3.appendChild(el("div", "kpi__label", "Темп"));
  k3.appendChild(el("div", "kpi__value mono", featToday > 0 ? "+" + featToday : "—"));
  k3.appendChild(el("div", "kpi__sub", "feat(bank) за сегодня"));
  kpiRow.appendChild(k3);

  // KPI 4: Гейты
  // ВНИМАНИЕ: severity-сортировка (в focus-row) работает только для
  // 'SUBSTANTIAL'. Если появятся другие значения (CRITICAL, HIGH) — обновить
  // логику (BACKLOG).
  const order = ["qc", "typecheck", "vitest", "shuffle_bank"];
  let passCount = 0;
  const dotsWrap = el("div", "gate-dots");
  for (const name of order) {
    const g = gates[name] || {};
    const st = g.status || "unknown";
    if (st === "pass") passCount += 1;
    const cls = st === "pass" ? "pass" : st === "fail" ? "fail" : "warn";
    dotsWrap.appendChild(el("span", "gate-dot gate-dot--" + cls));
  }
  const k4 = el("div", "kpi");
  k4.appendChild(el("div", "kpi__label", "Гейты"));
  k4.appendChild(dotsWrap);
  k4.appendChild(el("div", "kpi__sub", passCount + "/4 pass"));
  kpiRow.appendChild(k4);

  mount.appendChild(kpiRow);

  // FOCUS-ROW
  const focusRow = el("section", "focus-row");
  const next = lastIdx >= 0 && lastIdx + 1 < ms.length ? ms[lastIdx + 1] : null;
  const cur = goal.current_questions || 0;

  const f1 = el("div", "focus");
  f1.appendChild(el("div", "focus__title", "Что дальше"));
  const f1main = next
    ? next.id + " · " + asText(next.title, "").slice(0, 60)
    : "—";
  f1.appendChild(el("div", "focus__main mono", f1main));
  f1.appendChild(el("div", "focus__sub",
    "До 200: " + Math.max(0, 200 - cur) + " · До 300: " + Math.max(0, 300 - cur)));
  focusRow.appendChild(f1);

  const sorted = issues.slice().sort(function (a, b) {
    return (a.severity === "SUBSTANTIAL" ? 0 : 1) - (b.severity === "SUBSTANTIAL" ? 0 : 1);
  });
  const f2 = el("div", "focus");
  f2.appendChild(el("div", "focus__title", "Что болит"));
  const top3 = sorted.slice(0, 3);
  if (top3.length === 0) {
    f2.appendChild(el("div", "focus__sub", "нет открытых"));
  } else {
    for (const iss of top3) {
      const line = el("div", "issue-line");
      line.appendChild(el("span",
        "issue-line__sev" + (iss.severity === "MINOR" ? " issue-line__sev--minor" : ""),
        asText(iss.severity, "—")));
      line.appendChild(el("span", "issue-line__txt",
        asText(iss.id, "") + " — " + asText(iss.note, "").slice(0, 80)));
      f2.appendChild(line);
    }
    if (sorted.length > 3) {
      const rest = sorted.length - 3;
      const restMinor = sorted.slice(3).every(function (x) { return x.severity === "MINOR"; });
      f2.appendChild(el("div", "focus__sub",
        restMinor ? "+" + rest + " MINOR" : "+" + rest + " ещё"));
    }
  }
  focusRow.appendChild(f2);
  mount.appendChild(focusRow);

  // DETAILS: Milestones (свёрнуто по умолчанию, состояние переносится)
  const dMil = el("details", "details");
  dMil.id = "details-milestones";
  if (openMil) dMil.open = true;
  dMil.appendChild(el("summary", null, "Milestones (" + ms.length + ")"));
  const milList = el("div", "milestones-list");
  for (const m of ms) {
    const row = el("div", "milestone-row status-" + asText(m.status, "planned"));
    row.appendChild(el("span", "mono", asText(m.id, "") + " "));
    row.appendChild(el("span", null, asText(m.title, "")));
    milList.appendChild(row);
  }
  dMil.appendChild(milList);
  mount.appendChild(dMil);

  // DETAILS: Activity (топ-5 коммитов)
  const dAct = el("details", "details");
  dAct.id = "details-activity";
  if (openAct) dAct.open = true;
  dAct.appendChild(el("summary", null, "Activity"));
  const actList = el("div", "activity-list");
  for (const c of commits.slice(0, 5)) {
    const row = el("div", "activity-row");
    row.appendChild(el("span", "mono", asText(c.hash, "") + "  "));
    row.appendChild(el("span", "mono", relativeTime(c.date) + "  "));
    row.appendChild(el("span", null, asText(c.message, "").slice(0, 60)));
    actList.appendChild(row);
  }
  dAct.appendChild(actList);
  mount.appendChild(dAct);

  if (lastUpdate) lastUpdate.textContent = asText(state.last_update, "—");
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
