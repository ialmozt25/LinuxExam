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

// Рендер V5: hero-прогресс + dual-карточки + список внимания + свёрнутые details.
// Идемпотентен: повторный вызов заменяет содержимое, но сохраняет состояние
// открытости <details>, чтобы auto-refresh не схлопывал раскрытые блоки.
function render(state) {
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

  // === HERO ===
  const hero = el("section", "hero");
  hero.appendChild(el("div", "hero__title", "Вопросов в базе"));

  const heroMain = el("div", "hero__main");
  const cur = goal.current_questions || 0;
  const tgt = goal.target_questions || 300;
  const num = el("div", "hero__number");
  num.appendChild(el("span", "hero__number-current", String(cur)));
  num.appendChild(el("span", "hero__number-sep", "/"));
  num.appendChild(el("span", null, String(tgt)));
  heroMain.appendChild(num);
  heroMain.appendChild(el("div", "hero__remaining", "осталось " + Math.max(0, tgt - cur)));
  hero.appendChild(heroMain);

  const bar = el("div", "hero__bar");
  const fill = el("div", "hero__fill");
  fill.style.width = (goal.progress_percent || 0) + "%";
  bar.appendChild(fill);
  hero.appendChild(bar);

  // Локальная дата (не UTC) — «сегодня» для метрики темпа.
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
  const meta = qAdded > 0
    ? "Сегодня добавили " + qAdded + (qAdded === 1 ? " вопрос" : " вопросов")
    : "Сегодня пока без изменений";
  hero.appendChild(el("div", "hero__meta", meta));

  mount.appendChild(hero);

  // === DUAL ===
  let lastIdx = -1;
  for (let i = 0; i < ms.length; i += 1) {
    if (ms[i].status === "completed") lastIdx = i;
  }
  const lastCompleted = lastIdx >= 0 ? ms[lastIdx] : null;
  const next = lastIdx >= 0 && lastIdx + 1 < ms.length ? ms[lastIdx + 1] : null;

  const dual = el("div", "dual");

  const left = el("div", "dual-card dual-card--done");
  left.appendChild(el("div", "dual-card__title", "Последнее достижение"));
  left.appendChild(el("div", "dual-card__main",
    lastCompleted ? milestoneLabel(lastCompleted.id, lastCompleted.title) : "—"));
  left.appendChild(el("div", "dual-card__sub", "готово"));
  dual.appendChild(left);

  const right = el("div", "dual-card dual-card--next");
  right.appendChild(el("div", "dual-card__title", "Следующий этап"));
  right.appendChild(el("div", "dual-card__main",
    next ? milestoneLabel(next.id, next.title) : "—"));
  right.appendChild(el("div", "dual-card__sub", next ? "по плану" : "план завершён"));
  dual.appendChild(right);

  mount.appendChild(dual);

  // === ATTENTION ===
  const attention = el("section", "attention");
  attention.appendChild(el("div", "attention__title", "Требует внимания"));
  if (issues.length === 0) {
    attention.appendChild(el("div", "attention__more", "Проблем нет"));
  } else {
    const list = el("ol", "attention__list");
    issues.slice(0, 3).forEach(function (iss, i) {
      const li = el("li", "attention__item");
      li.appendChild(el("span", "attention__num", (i + 1) + "."));
      const txt = asText(iss.note, "").replace(/^explanation про\s*/, "");
      li.appendChild(el("span", null, txt));
      list.appendChild(li);
    });
    attention.appendChild(list);
    if (issues.length > 3) {
      attention.appendChild(el("div", "attention__more",
        "Ещё " + (issues.length - 3) + " — в деталях"));
    }
  }
  mount.appendChild(attention);

  // === DETAILS: Пройденные этапы ===
  const dMil = el("details", "details");
  dMil.id = "details-milestones";
  if (openMil) dMil.open = true;
  dMil.appendChild(el("summary", null, "Пройденные этапы (" + ms.length + ")"));
  const milList = el("div", "milestones-list");
  for (const m of ms) {
    const row = el("div", "milestone-row");
    row.appendChild(el("span", null, milestoneLabel(m.id, m.title) + " "));
    row.appendChild(el("span", "milestone-row__status",
      "(" + (STATUS_LABELS[m.status] || asText(m.status, "—")) + ")"));
    milList.appendChild(row);
  }
  dMil.appendChild(milList);
  mount.appendChild(dMil);

  // === DETAILS: Последние изменения ===
  const dAct = el("details", "details");
  dAct.id = "details-activity";
  if (openAct) dAct.open = true;
  dAct.appendChild(el("summary", null, "Последние изменения"));
  const actList = el("div", "activity-list");
  for (const c of commits.slice(0, 5)) {
    const row = el("div", "activity-row");
    row.appendChild(el("span", "mono", asText(c.hash, "").slice(0, 7)));
    row.appendChild(el("span", "mono", relativeTime(c.date)));
    row.appendChild(el("span", null, humanizeCommit(c.message)));
    actList.appendChild(row);
  }
  dAct.appendChild(actList);
  mount.appendChild(dAct);

  // === last_update ===
  if (lastUpdate) lastUpdate.textContent = relativeTime(state.last_update);
}

// Технические префиксы коммитов → человеческий язык.
function humanizeCommit(msg) {
  if (!msg) return "";
  return String(msg)
    .replace(/^feat\(bank\):\s*/i, "Добавлены вопросы: ")
    .replace(/^docs\(project\):\s*/i, "Документация: ")
    .replace(/^feat\(dashboard\):\s*/i, "Дашборд: ")
    .replace(/^feat\(tools\):\s*/i, "Инструменты: ")
    .replace(/^fix\(parser\):\s*/i, "Исправление: ")
    .replace(/^chore\(repo\):\s*/i, "Обслуживание: ");
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
