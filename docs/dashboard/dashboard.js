// Dashboard V5/V6/V8 — ES-модуль (подключается как <script type="module">).
// Модули и так strict по спецификации, явный "use strict" не нужен.
// V8: продуктовый вид (прогресс, темы, следующий шаг). Процессные данные
// (milestones / commits / гейты) больше не рендерятся, поэтому import
// humanizeCommit отсюда убран — сам модуль humanize.mjs остаётся (12 тестов).

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

// Рендер V8: продуктовый вид — большой прогресс, распределение по темам,
// следующий шаг. Идемпотентен (mount.replaceChildren), состояния <details>
// больше нет. Только createElement/textContent.
function render(state) {
  mount.replaceChildren();

  // Защита от undefined в state.
  const goal = state.goal || {};
  const topics = Array.isArray(state.topics) ? state.topics : [];

  // === ПРОГРЕСС ===
  const cur = goal.current_questions || 0;
  const tgt = goal.target_questions || 300;
  const pct = goal.progress_percent || 0;

  const prog = el("section", "progress-big");
  prog.appendChild(el("div", "progress-big__title", "Вопросов в базе"));
  const nums = el("div", "progress-big__numbers");
  nums.appendChild(el("span", "progress-big__current", String(cur)));
  nums.appendChild(el("span", "progress-big__sep", "/"));
  nums.appendChild(el("span", "progress-big__total", String(tgt)));
  nums.appendChild(el("span", "progress-big__pct", String(pct) + "%"));
  prog.appendChild(nums);

  const bar = el("div", "progress-big__bar");
  const fill = el("div", "progress-big__fill");
  fill.style.width = String(pct) + "%";
  bar.appendChild(fill);
  prog.appendChild(bar);
  mount.appendChild(prog);

  // === ТЕМЫ (дыры сверху: сортировка по count ASC — намеренно) ===
  const grid = el("section", "topics-grid");
  grid.appendChild(el("div", "topics-grid__title", "По темам"));
  const sortedTopics = topics.slice().sort(function (a, b) {
    return (a.count || 0) - (b.count || 0);
  });
  for (const t of sortedTopics) {
    const row = el("div", "topic-row");
    row.appendChild(el("div", "topic-row__label", t.label || t.slug || "—"));

    const tbar = el("div", "topic-row__bar");
    const tfill = el("div", "topic-row__fill");
    const target = t.target || 22;
    const count = t.count || 0;
    const ratio = Math.min(100, (count / target) * 100);
    tfill.style.width = ratio + "%";
    if (count < target * 0.5) {
      tfill.className = "topic-row__fill topic-row__fill--gap";
    }
    tbar.appendChild(tfill);
    row.appendChild(tbar);

    row.appendChild(el("div", "topic-row__count", count + " / " + target));
    grid.appendChild(row);
  }
  mount.appendChild(grid);

  // === СЛЕДУЮЩИЙ ШАГ (тема с минимумом, кроме только что наполненных) ===
  const recent = ["users_groups", "essential_tools"];
  const candidates = topics
    .filter(function (t) { return recent.indexOf(t.slug) === -1; })
    .sort(function (a, b) { return (a.count || 0) - (b.count || 0); });
  const nextTopic = candidates[0] || null;
  const remaining = Math.max(0, tgt - cur);

  const step = el("div", "next-step");
  step.appendChild(el("span", null, "Следующий шаг: "));
  step.appendChild(el("span", "next-step__strong",
    nextTopic ? (nextTopic.label || nextTopic.slug) : "—"));
  step.appendChild(el("span", null, " (+6). До 300 осталось " + remaining + " вопросов."));
  mount.appendChild(step);

  // === last_update ===
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

// Переключатель темы: тот же ключ и то же поведение, что в приложении
// (src/utils/theme.ts, src/hooks/useThemeController.ts).
//   'lx-theme' ABSENT            -> inherit (системная / Telegram)
//   'lx-theme' = 'light' | 'dark' -> явный выбор пользователя
const THEME_STORAGE_KEY = "lx-theme";

// Иконки кнопки — те же, что в приложении (lucide-react: Sun / MoonStar).
const THEME_ICON_SUN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="4"></circle>' +
  '<path d="M12 2v2"></path><path d="M12 20v2"></path>' +
  '<path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path>' +
  '<path d="M2 12h2"></path><path d="M20 12h2"></path>' +
  '<path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>' +
  "</svg>";
const THEME_ICON_MOON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>' +
  "</svg>";

const themeBtn = document.getElementById("theme-btn");

// Иконка и aria-label переключателя — как в приложении: показываем ту тему,
// на которую переключит клик (тёмная тема -> солнце, светлая -> луна).
function updateThemeLabel() {
  if (!themeBtn) return;
  const t = document.documentElement.getAttribute("data-theme") || "dark";
  themeBtn.innerHTML = t === "light" ? THEME_ICON_SUN : THEME_ICON_MOON;
  themeBtn.setAttribute("aria-label",
    t === "light" ? "Переключить на тёмную" : "Переключить на светлую");
}

function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem(THEME_STORAGE_KEY, t); } catch (e) { /* ignore */ }
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
