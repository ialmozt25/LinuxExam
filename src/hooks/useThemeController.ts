import { useEffect, useState, useSyncExternalStore } from 'react';
import { getTelegramThemeState, subscribeTelegramTheme } from '@/platform/telegramTheme';
import {
  applyThemeChoice,
  resolveTheme,
  type ResolvedTheme,
  type ThemeChoice,
} from '@/utils/theme';

const MEDIA_QUERY = '(prefers-color-scheme: dark)';
// Mirrors the private STORAGE_KEY in utils/theme.ts. That constant is not
// exported and theme.ts is out of scope here, so the key is repeated.
const STORAGE_KEY = 'lx-theme';

function readOsIsDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia(MEDIA_QUERY).matches;
}

/**
 * Manual choice, or null while the app follows Telegram / the system.
 * Absence of the storage key is what 'inherit' means.
 */
function readManual(): ResolvedTheme | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // localStorage unavailable
  }
  return null;
}

function toChoice(manual: ResolvedTheme | null): ThemeChoice {
  return manual === null ? 'system' : manual;
}

/**
 * The Telegram colour scheme, or the OS preference when no trustworthy Telegram
 * signal exists. Strict comparison on purpose: a missing/unreadable signal yields
 * undefined, which must NOT be read as 'dark'.
 */
function readSystemTheme(): ResolvedTheme {
  const fromMedia = (): ResolvedTheme =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(MEDIA_QUERY).matches
        ? 'dark'
        : 'light'
      : 'dark';
  // Read through the SDK-free bridge: the adapter publishes into it when the SDK
  // loads, so this stays accurate without importing the SDK here.
  const telegram = getTelegramThemeState();
  if (telegram.inTMA) {
    if (telegram.isDark === true) return 'dark';
    if (telegram.isDark === false) return 'light';
  }
  return fromMedia();
}

export interface ThemeController {
  /** The theme actually in effect right now. */
  resolved: ResolvedTheme;
  /** Flips to the opposite theme, or back to inherit when it equals the system one. */
  toggle: () => void;
}

/**
 * Single source of truth for the active theme. Called exactly once, from App.
 *
 * Two live inputs are merged here:
 * - inside Telegram, the colour scheme published by the SDK adapter into the
 *   SDK-free bridge (`@/platform/telegramTheme`), subscribed through
 *   useSyncExternalStore, so the app follows the client theme and reacts when the
 *   user switches Telegram's own theme. The SDK itself is never imported here — it
 *   is reached only through the dynamic import in main.tsx, which keeps ~17 kB gzip
 *   of SDK out of the initial chunk;
 * - outside Telegram, `matchMedia` with a change listener.
 *
 * `applyThemeChoice` receives the Telegram signal, otherwise it would fall back to
 * the OS preference and an inheriting app inside Telegram would show the wrong theme.
 *
 * The `--tg-theme-*` variables are published by the adapter's bindThemeCssVars call
 * when the SDK loads; the [data-theme-source="inherit"] block in tokens.css consumes
 * them.
 */
export function useThemeController(): ThemeController {
  // Re-renders when the adapter publishes a new Telegram colour scheme. The bridge
  // hands back a stable snapshot object, so this does not loop.
  const telegram = useSyncExternalStore(
    subscribeTelegramTheme,
    getTelegramThemeState,
    getTelegramThemeState
  );
  const inTelegram = telegram.inTMA;

  // Subscribed through the bridge rather than read inline: the component must
  // re-render when Telegram flips its color scheme.
  const telegramIsDark = telegram.isDark;

  const [osIsDark, setOsIsDark] = useState<boolean>(readOsIsDark);
  const [manual, setManual] = useState<ResolvedTheme | null>(readManual);

  // OS preference changes.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(MEDIA_QUERY);
    const onChange = (e: MediaQueryListEvent) => setOsIsDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // The Telegram palette (--tg-theme-*) is bound by the SDK adapter at init (see
  // bindThemeCssVars in platform/telegram_adapter.ts): it is an SDK concern, and
  // binding before the first paint is strictly better. This hook stays SDK-free.

  const resolved = resolveTheme(toChoice(manual), {
    inTelegram,
    telegramIsDark: inTelegram ? telegramIsDark : undefined,
  });

  useEffect(() => {
    applyThemeChoice(toChoice(manual), inTelegram ? telegramIsDark : undefined);
  }, [manual, inTelegram, telegramIsDark, osIsDark]);

  const toggle = () => {
    const newChoice: ResolvedTheme = resolved === 'dark' ? 'light' : 'dark';
    const systemTheme = readSystemTheme();
    const next: ResolvedTheme | null = newChoice === systemTheme ? null : newChoice;
    try {
      if (next === null) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable: the choice still applies for this session.
    }
    // Drives the re-render; the effect above then paints the new theme.
    setManual(next);
  };

  return { resolved, toggle };
}
