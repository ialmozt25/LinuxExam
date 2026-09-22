import { useEffect, useState } from 'react';
import { isTMA, themeParams, useSignal } from '@telegram-apps/sdk-react';
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
 * The Telegram colour scheme, or undefined when it cannot be trusted.
 * Strict comparison on purpose: a Computed that is not mounted yields undefined,
 * which must NOT be read as 'dark'.
 */
function readSystemTheme(): ResolvedTheme {
  const fromMedia = (): ResolvedTheme =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(MEDIA_QUERY).matches
        ? 'dark'
        : 'light'
      : 'dark';
  try {
    if (isTMA() === true) {
      const value = themeParams.isDark();
      if (value === true) return 'dark';
      if (value === false) return 'light';
    }
  } catch {
    // Fall through to the OS preference.
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
 * - inside Telegram, `themeParams.isDark` (a Computed signal, subscribed via
 *   `useSignal`) so the app follows the client theme and reacts when the user
 *   switches Telegram's own theme;
 * - outside Telegram, `matchMedia` with a change listener.
 *
 * `applyThemeChoice` receives the Telegram signal, otherwise it would fall back to
 * the OS preference and an inheriting app inside Telegram would show the wrong theme.
 *
 * `themeParams.bindCssVars()` publishes `--tg-theme-*` on <html> and keeps them in
 * sync, which the [data-theme-source="inherit"] block in tokens.css consumes.
 */
export function useThemeController(): ThemeController {
  const inTelegram = isTMA();

  // Subscribing through the SDK hook rather than reading the signal inline: the
  // component must re-render when Telegram flips its color scheme.
  const telegramIsDark = useSignal(themeParams.isDark);

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

  // Publish (and keep publishing) the Telegram palette as CSS variables.
  useEffect(() => {
    if (!inTelegram) return;
    const bind = themeParams.bindCssVars;
    if (typeof bind !== 'function') return;
    let unbind: (() => void) | undefined;
    try {
      if (typeof bind.isAvailable === 'function' && !bind.isAvailable()) return;
      unbind = bind();
    } catch {
      // Already bound, or the component is not mounted: existing variables stay.
      return;
    }
    return () => {
      try {
        unbind?.();
      } catch {
        // Best-effort on teardown.
      }
    };
  }, [inTelegram]);

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
