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

// Словари переводов: внутренние коды → человеческий язык.
const MILESTONE_LABELS = {
  'M0': 'Каркас проекта', 'M0.5': 'База знаний', 'M0.7': 'Мост DeepSeek ↔ DSH',
  'M1': 'Агент Writer', 'M1.5': 'Пайплайн Writer',
  'M2': 'Агент QC', 'M2.1': 'Архитектура QC', 'M2.2': 'Пресет QC-аудитора',
  'M2.3': 'Контракт Writer → QC', 'M2.4': 'Контракт QC → Orchestrator',
  'M2.5': 'Тест пресета QC', 'M2.6': 'Тестовый цикл', 'M2.7': 'Закрытие M2',
  'M2.8': 'Первая реальная генерация', 'M2.9': 'Наполнение банка вопросов',
  'M3': 'Центр Управления', 'M3.1': 'Данные о состоянии проекта',
  'M3.2': 'Сборщик данных', 'M3.3': 'Дизайн дашборда', 'M3.4': 'Дашборд',
  'M3.5': 'Авто-обновление данных', 'M3.6': 'Центр Управления готов',
  'M3.7': 'Перенос знаний между проектами',
  'M4': 'Резервные копии', 'M5': 'Монетизация', 'M6': 'Масштабирование'
};
const STATUS_LABELS = {
  'completed': 'готово', 'in_progress': 'в работе', 'planned': 'в плане'
};
const SEVERITY_LABELS = { 'SUBSTANTIAL': 'Важно', 'MINOR': 'мелко' };

function milestoneLabel(id, fallback) {
  return MILESTONE_LABELS[id] || fallback || id;
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

  // KPI 1: Вопросов
  const k1 = el("div", "kpi");
  k1.appendChild(el("div", "kpi__label", "Вопросов"));
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

  // KPI 2: Готово — последний completed milestone (человеческое имя).
  let lastIdx = -1;
  for (let i = 0; i < ms.length; i += 1) {
    if (ms[i].status === "completed") lastIdx = i;
  }
  const lastCompleted = lastIdx >= 0 ? ms[lastIdx] : null;

  const k2 = el("div", "kpi");
  k2.appendChild(el("div", "kpi__label", "Готово"));
  const k2value = lastCompleted
    ? milestoneLabel(lastCompleted.id, lastCompleted.title)
    : "—";
  k2.appendChild(el("div", "kpi__value", k2value));
  kpiRow.appendChild(k2);

  // KPI 3: Сегодня — сколько вопросов добавлено (локальная дата, не UTC).
  const d = new Date();
  const today = d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
  const qAdded = commits
    .filter(function (c) {
      return c.date === today && asText(c.message, "").startsWith("feat(bank)");
    })
    .reduce(function (sum, c) {
      const m = asText(c.message, "").match(/(\d+)\s+questions?/i);
      return sum + (m ? parseInt(m[1], 10) : 0);
    }, 0);

  const k3 = el("div", "kpi");
  k3.appendChild(el("div", "kpi__label", "Сегодня"));
  k3.appendChild(el("div", "kpi__value mono", qAdded > 0 ? "+" + qAdded : "—"));
  k3.appendChild(el("div", "kpi__sub", "вопросов добавлено"));
  kpiRow.appendChild(k3);

  // KPI 4: Проверки
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
  k4.appendChild(el("div", "kpi__label", "Проверки"));
  k4.appendChild(dotsWrap);
  k4.appendChild(el("div", "kpi__sub", passCount + " из 4 ок"));
  kpiRow.appendChild(k4);

  mount.appendChild(kpiRow);

  // FOCUS-ROW
  const focusRow = el("section", "focus-row");
  const next = lastIdx >= 0 && lastIdx + 1 < ms.length ? ms[lastIdx + 1] : null;
  const cur = goal.current_questions || 0;

  const f1 = el("div", "focus");
  f1.appendChild(el("div", "focus__title", "Следующий этап"));
  const f1main = next ? milestoneLabel(next.id, next.title) : "—";
  f1.appendChild(el("div", "focus__main", f1main));
  f1.appendChild(el("div", "focus__sub",
    "Осталось до цели: " + Math.max(0, 300 - cur) + " вопросов"));
  focusRow.appendChild(f1);

  const sorted = issues.slice().sort(function (a, b) {
    return (a.severity === "SUBSTANTIAL" ? 0 : 1) - (b.severity === "SUBSTANTIAL" ? 0 : 1);
  });
  const f2 = el("div", "focus");
  f2.appendChild(el("div", "focus__title", "Проблемы"));
  const top3 = sorted.slice(0, 3);
  if (top3.length === 0) {
    f2.appendChild(el("div", "focus__sub", "всё чисто"));
  } else {
    for (const iss of top3) {
      const line = el("div", "issue-line");
      line.appendChild(el("span",
        "issue-line__sev" + (iss.severity === "MINOR" ? " issue-line__sev--minor" : ""),
        SEVERITY_LABELS[iss.severity] || asText(iss.severity, "—")));
      const note = asText(iss.note, "").replace(/^explanation про\s*/, "");
      line.appendChild(el("span", "issue-line__txt", note.slice(0, 80)));
      f2.appendChild(line);
    }
    if (sorted.length > 3) {
      const rest = sorted.length - 3;
      const restMinor = sorted.slice(3).every(function (x) { return x.severity === "MINOR"; });
      f2.appendChild(el("div", "focus__sub",
        restMinor ? "+" + rest + " мелких" : "+" + rest + " ещё"));
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
    const statusText = STATUS_LABELS[m.status] || asText(m.status, "—");
    row.appendChild(el("span", null,
      milestoneLabel(m.id, m.title) + "  (" + statusText + ")"));
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

  if (lastUpdate) lastUpdate.textContent = relativeTime(state.last_update);
}

// Обновление по успешной загрузке: таймстемп + перерисовка.
function renderIfOk(s) {
  if (s !== null && s !== undefined) {
    lastUpdateTs = Date.now();
    render(s);
  }
}

// Ручное обновление кнопкой.
const refreshBtn = document.getElementById("refresh-btn");
if (refreshBtn) {
  refreshBtn.addEventListener("click", () => {
    loadState().then(renderIfOk);
  });
}

// Переключатель темы: значение из <html data-theme>, запись в localStorage.
const themeBtn = document.getElementById("theme-btn");

function updateThemeLabel() {
  if (!themeBtn) return;
  const t = document.documentElement.getAttribute("data-theme") || "dark";
  themeBtn.textContent = "Тема: " + (t === "light" ? "светлая" : "тёмная");
}

function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem("linuxexam-theme", t); } catch (e) { /* ignore */ }
  updateThemeLabel();
}

if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(cur === "light" ? "dark" : "light");
  });
}
updateThemeLabel();

// Автообновление раз в 30 секунд; в скрытой вкладке не выполняется.
setInterval(() => {
  if (document.hidden) return;
  loadState().then(renderIfOk);
}, 30000);

async function init() {
  renderIfOk(await loadState());
}

init();
