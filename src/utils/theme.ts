export type ThemeChoice = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export type ThemeSource = 'inherit' | 'manual';

const STORAGE_KEY = 'lx-theme';
const MANUAL_KEY = 'lx-theme-manual';
const DEFAULT_MANUAL: ResolvedTheme = 'dark';

/**
 * The user's stored preference. 'system' is a real third state, not a
 * fallback for "unset" - it is written to localStorage like any explicit
 * choice, so switching back to it is preserved.
 */
export function getThemeChoice(): ThemeChoice {
  if (typeof window === 'undefined') return 'system';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch {
    // localStorage unavailable (private mode / blocked storage)
  }
  return 'system';
}

/** OS preference. Used outside Telegram, and by the legacy 'system' path. */
export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return DEFAULT_MANUAL;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export interface ThemeSignals {
  /** True inside a Telegram Mini App. */
  inTelegram: boolean;
  /** Current value of themeParams.isDark(). */
  telegramIsDark: boolean;
  /** Current OS preference. */
  osIsDark: boolean;
}

/**
 * `system` resolves to the Telegram palette inside Telegram and to the OS
 * preference elsewhere; every other choice wins unconditionally.
 */
export function resolveTheme(choice: ThemeChoice, signals?: ThemeSignals): ResolvedTheme {
  if (choice !== 'system') return choice;
  if (signals) {
    if (signals.inTelegram) return signals.telegramIsDark ? 'dark' : 'light';
    return signals.osIsDark ? 'dark' : 'light';
  }
  return getSystemTheme();
}

/** Last manual (non-system) choice. Used by the Settings switch. */
export function readManualChoice(): ResolvedTheme {
  if (typeof window === 'undefined') return DEFAULT_MANUAL;
  try {
    const saved = window.localStorage.getItem(MANUAL_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    const primary = window.localStorage.getItem(STORAGE_KEY);
    if (primary === 'light' || primary === 'dark') return primary;
  } catch {
    // localStorage unavailable
  }
  return DEFAULT_MANUAL;
}

/** True while the app follows Telegram / the system instead of a manual choice. */
export function getFollowSystem(): boolean {
  return getThemeChoice() !== 'light' && getThemeChoice() !== 'dark';
}

export interface ThemeState {
  /** Persisted single source of truth. */
  choice: ThemeChoice;
  /** Last manual choice, retained even while following the system. */
  manual: ResolvedTheme;
  followSystem: boolean;
}

export function getThemeState(): ThemeState {
  const choice = getThemeChoice();
  return { choice, manual: readManualChoice(), followSystem: getFollowSystem() };
}

/**
 * Turns the follow switch on: the persisted choice becomes 'system' while the
 * manual choice is remembered for when the switch is turned off again.
 */
export function setFollowSystem(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    const manual = readManualChoice();
    window.localStorage.setItem(MANUAL_KEY, manual);
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'system' : manual);
  } catch {
    // session-only fallback
  }
}

/**
 * Writes the RESOLVED theme plus the source of that decision to <html>.
 *
 * `data-theme-source="inherit"` makes the CSS hex overrides in tokens.css
 * step aside so the live Telegram palette (--tg-theme-*) shows through.
 */
export function applyThemeState(state: ThemeState): ResolvedTheme {
  const resolved = resolveTheme(state.choice);
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute(
      'data-theme-source',
      state.followSystem ? 'inherit' : 'manual'
    );
  }
  return resolved;
}

/**
 * Back-compat entry point: keeps the exact signature the app already calls, so
 * main.tsx needs no change. The source is derived from the choice.
 */
export function applyThemeChoice(choice: ThemeChoice): void {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(choice);
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.setAttribute(
    'data-theme-source',
    choice === 'system' ? 'inherit' : 'manual'
  );
  try {
    window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // session-only fallback
  }
}
