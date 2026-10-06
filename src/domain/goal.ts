/**
 * Дневная цель и серия (spec 061). Domain-слой: чистые функции, ноль импортов
 * zustand/react (правило слоя domain).
 *
 * Здесь живёт ровно та арифметика retention-зоны, которая не зависит от стора:
 * варианты дневной цели, доля выполненного, текст серии и её цветовое состояние.
 * Само состояние (streak / todayXp / lastActiveDate) остаётся в сторе.
 */

/**
 * Три варианта дневной цели: light / normal / intense.
 *
 * Верхний пресет — 30 XP (задание «XP-механика», было 50): при новой таблице
 * начисления (первый ответ дня +10, верный ответ +3) 50 XP требовали бы ~13
 * верных ответов подряд, то есть цели, недостижимой за одну сессию.
 */
export const DAILY_GOAL_OPTIONS: readonly number[] = [10, 20, 30];

/**
 * Дефолт дневной цели: пока picker не пройден, целью считается он.
 * Миграция пишет ровно это значение, поэтому дефолт — не только UI-подсказка.
 *
 * 30 XP (задание «XP-механика», было 20).
 */
export const DEFAULT_DAILY_GOAL_XP = 30;

/**
 * Прежний дефолт дневной цели (spec 061). Нужен ТОЛЬКО миграции: отличить
 * «цель не выбирали, пришёл дефолт» от явного выбора пользователя в сохранённом
 * состоянии невозможно, поэтому миграция переписывает ровно это значение.
 */
export const LEGACY_DEFAULT_DAILY_GOAL_XP = 20;

/** Границы цветовых состояний бара (доли от дневной цели). */
export const XP_ACCENT_THRESHOLD = 0.5;
export const XP_MARK_THRESHOLD = 0.85;

export interface DailyProgress {
  todayXp: number;
  goalXp: number;
  /** Доля 0…1; при `goalXp <= 0` — 0 (без NaN и деления на ноль). */
  ratio: number;
  /** Цель на сегодня достигнута. */
  met: boolean;
}

/**
 * Прогресс к дневной цели. `goalXp <= 0` трактуется как «цели нет»: доля 0,
 * `met` — false, чтобы UI не показывал выполненную цель на пустой настройке.
 */
export function computeDailyProgress(todayXp: number, goalXp: number): DailyProgress {
  const safeToday = Number.isFinite(todayXp) ? todayXp : 0;
  const safeGoal = Number.isFinite(goalXp) ? goalXp : 0;
  if (safeGoal <= 0) {
    return { todayXp: safeToday, goalXp: safeGoal, ratio: 0, met: false };
  }
  return {
    todayXp: safeToday,
    goalXp: safeGoal,
    ratio: Math.max(0, Math.min(1, safeToday / safeGoal)),
    met: safeToday >= safeGoal,
  };
}

/** Цвет заполнения бара по доле: <50 % серый, 50–84 % акцент, ≥85 % зелёный. */
export function xpBarColor(ratio: number): 'gray' | 'accent' | 'green' {
  if (ratio >= XP_MARK_THRESHOLD) return 'green';
  if (ratio >= XP_ACCENT_THRESHOLD) return 'accent';
  return 'gray';
}

/**
 * Форма слова «день» для числа (dashboard-ux-2, A2): 1 → «день», 2–4 → «дня»,
 * 5–20 → «дней», 21 → «день», 22–24 → «дня», 25–30 → «дней», 31 → «день».
 *
 * Подростковый диапазон 11–19 — исключение (`abs` считается по модулю 100,
 * поэтому и 111–114 → «дней»), отсюда проверка `abs`, а не `last`.
 */
export function pluralDays(n: number): string {
  const abs = Math.abs(Math.floor(Number.isFinite(n) ? n : 0)) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 19) return 'дней';
  if (last >= 2 && last <= 4) return 'дня';
  if (last === 1) return 'день';
  return 'дней';
}

/**
 * Текст серии. Гарантия контракта: для любого входа возвращается НЕПУСТАЯ
 * строка — отрицательные значения (которых стор не создаёт) приравнены к нулю.
 *
 * Слово «день» согласуется с числом через `pluralDays`: до dashboard-ux-2 здесь
 * стояло жёсткое «дней», и серия из 2–4 дней давала «2 дней подряд».
 */
export function streakMessage(streak: number): string {
  const days = Number.isFinite(streak) ? Math.max(0, Math.floor(streak)) : 0;
  if (days === 0) return 'Начните серию!';
  if (days === 1) return 'День 1 — хорошее начало';
  if (days === 30) return 'Месяц!';
  if (days >= 100) return 'Легенда';
  return `${days} ${pluralDays(days)} подряд`;
}

/** Цветовое состояние сообщения серии: active / warning / broken. */
export type StreakColor = 'green' | 'orange' | 'red';

export type StreakState = 'active' | 'warning' | 'broken';

/**
 * Состояние серии по сегодняшней активности: сегодня занимались — active,
 * вчера — warning (серия ещё жива, но сегодня не подтверждена), раньше или
 * никогда — broken.
 */
export function streakStateByActivity(todayXp: number, lastActiveDate: string | null, today: string): StreakState {
  if (todayXp > 0) return 'active';
  if (lastActiveDate === null) return 'broken';
  const yesterday = shiftIsoDate(today, -1);
  if (lastActiveDate === today || lastActiveDate === yesterday) return 'warning';
  return 'broken';
}

/**
 * Цвет сообщения серии. Контракт задания — функция длины серии:
 * 0 → broken (red), 1–6 → active (green), ≥7 → warning (orange).
 *
 * Компонент берёт цвет через `stateColor` (по фактическому сегодняшнему
 * состоянию), а этот вариант оставлен как домен-классификация длины серии.
 */
export function messageColor(streak: number): StreakColor {
  const days = Number.isFinite(streak) ? Math.max(0, Math.floor(streak)) : 0;
  if (days === 0) return 'red';
  if (days <= 6) return 'green';
  return 'orange';
}

/** Цвет состояния: active → green, warning → orange, broken → red. */
export function stateColor(state: StreakState): StreakColor {
  if (state === 'active') return 'green';
  if (state === 'warning') return 'orange';
  return 'red';
}

/** ISO-дата (`YYYY-MM-DD`) со сдвигом на `days` дней. Чистая, UTC-стабильная. */
export function shiftIsoDate(isoDate: string, days: number): string {
  const base = Date.parse(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(base)) return isoDate;
  return new Date(base + days * 86400000).toISOString().slice(0, 10);
}
