export type ThemeChoice = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export type ThemeSource = 'inherit' | 'manual';

const STORAGE_KEY = 'lx-theme';
const LEGACY_MANUAL_KEY = 'lx-theme-manual';

/**
 * Storage format (current):
 *   lx-theme ABSENT            -> inherit (follow Telegram / system)
 *   lx-theme = 'light' | 'dark' -> explicit manual choice
 *   lx-theme = 'system'         -> legacy value, still accepted as inherit
 *
 * `lx-theme-manual` is obsolete. migrateThemeStorage() removes it.
 */

/**
 * Normalises the persisted key. An absent key is inherit, which is reported as
 * 'system' because ThemeChoice keeps 'system' as the third state.
 */
export function getThemeChoice(): ThemeChoice {
  if (typeof window === 'undefined') return 'system';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // localStorage unavailable (private mode / blocked storage)
  }
  return 'system';
}

/**
 * One-way, idempotent storage migration from the old two-key model.
 *
 *   'system'                        -> key removed (absent means inherit)
 *   'light' | 'dark'                -> kept as-is
 *   absent + lx-theme-manual        -> manual value promoted to lx-theme
 *   lx-theme-manual (always)        -> removed
 *
 * No migration flag: running it twice equals running it once, so it can be
 * called unconditionally on every boot.
 */
export function migrateThemeStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const ls = window.localStorage;
    const choice = ls.getItem(STORAGE_KEY);
    const legacyManual = ls.getItem(LEGACY_MANUAL_KEY);

    if (choice === 'system') {
      ls.removeItem(STORAGE_KEY);
    } else if (choice === null && (legacyManual === 'light' || legacyManual === 'dark')) {
      ls.setItem(STORAGE_KEY, legacyManual);
    }

    ls.removeItem(LEGACY_MANUAL_KEY);
  } catch {
    // Storage unavailable: nothing to migrate, the app falls back to inherit.
  }
}

/**
 * Last explicit light/dark pick. With an absent key (inherit) the light theme is
 * reported, because that is what the OS/Telegram default resolves to when no
 * dark signal is available; the real value is always taken from the controller.
 */
export function readManualChoice(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // localStorage unavailable
  }
  return 'light';
}

/** True while the app follows Telegram / the system instead of a manual choice. */
export function getFollowSystem(): boolean {
  return getThemeChoice() === 'system';
}

/** OS preference. Used when no Telegram signal is available. */
export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export interface ResolveOptions {
  /** True inside a Telegram Mini App. */
  inTelegram: boolean;
  /**
   * Value of `themeParams.isDark()`. Kept as `boolean | undefined` so a signal
   * that is missing or unreadable cannot silently read as 'dark'.
   */
  telegramIsDark: boolean | undefined;
}

/**
 * `system` resolves to the Telegram palette inside Telegram and to the OS
 * preference elsewhere; every other choice wins unconditionally.
 *
 * Without options there is no Telegram signal to trust, so it falls back to the
 * OS preference.
 */
export function resolveTheme(choice: ThemeChoice, options?: ResolveOptions): ResolvedTheme {
  if (choice !== 'system') return choice;
  if (options && options.inTelegram && options.telegramIsDark === true) return 'dark';
  if (options && options.inTelegram && options.telegramIsDark === false) return 'light';
  return getSystemTheme();
}

export interface ThemeState {
  /** Persisted single source of truth. */
  choice: ThemeChoice;
  /** Last explicit pick, or null while inheriting. */
  manual: ResolvedTheme | null;
  followSystem: boolean;
}

export function getThemeState(): ThemeState {
  const choice = getThemeChoice();
  return {
    choice,
    manual: choice === 'light' || choice === 'dark' ? choice : null,
    followSystem: getFollowSystem(),
  };
}

/**
 * Writes the RESOLVED theme plus the source of that decision to <html>.
 *
 * `data-theme-source="inherit"` makes the hex overrides in tokens.css step aside
 * so the live Telegram palette (--tg-theme-*) shows through.
 */
export function applyThemeChoice(choice: ThemeChoice, telegramIsDark?: boolean): ResolvedTheme {
  const inTelegram = telegramIsDark !== undefined;
  const resolved = resolveTheme(choice, { inTelegram, telegramIsDark });
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute(
      'data-theme-source',
      choice === 'system' ? 'inherit' : 'manual'
    );
  }
  return resolved;
}

/**
 * Persists an explicit choice, or clears the key to go back to inherit. Never
 * writes 'system' - absence is what inherit means now.
 */
export function applyThemeState(state: ThemeState, telegramIsDark?: boolean): ResolvedTheme {
  if (typeof window !== 'undefined') {
    try {
      if (state.choice === 'light' || state.choice === 'dark') {
        window.localStorage.setItem(STORAGE_KEY, state.choice);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      window.localStorage.removeItem(LEGACY_MANUAL_KEY);
    } catch {
      // session-only fallback
    }
  }
  return applyThemeChoice(state.choice, telegramIsDark);
}
