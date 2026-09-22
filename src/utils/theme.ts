export type ThemeChoice = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'lx-theme';

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

/** OS preference. Only consulted while the choice is 'system'. */
export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  return choice === 'system' ? getSystemTheme() : choice;
}

/**
 * Writes the RESOLVED theme to <html data-theme>. CSS keys off that
 * attribute only - never off a prefers-color-scheme media query - so a
 * manual choice cannot be overridden by the OS.
 */
export function applyThemeChoice(choice: ThemeChoice): void {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(choice);
  document.documentElement.setAttribute('data-theme', resolved);
  try {
    window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // session-only fallback
  }
}
