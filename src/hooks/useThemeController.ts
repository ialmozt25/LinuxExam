import { useEffect, useState } from 'react';
import { isTMA, themeParams, useSignal } from '@telegram-apps/sdk-react';
import { applyThemeChoice, type ResolvedTheme, type ThemeChoice } from '@/utils/theme';

const MEDIA_QUERY = '(prefers-color-scheme: dark)';
const STORAGE_KEY = 'lx-theme';

function readOsIsDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia(MEDIA_QUERY).matches;
}

/**
 * Manual choice, or null while the app follows Telegram / the system.
 * Absence of the storage key is what 'inherit' means now.
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
 * Single source of truth for the active theme.
 *
 * Two live inputs are merged here:
 * - inside Telegram, `themeParams.isDark` (a Computed signal, subscribed via
 *   `useSignal`) so the app follows the client theme and reacts when the user
 *   switches Telegram's own theme;
 * - outside Telegram, `matchMedia` with a change listener.
 *
 * The Telegram signal is handed to `applyThemeChoice`, otherwise that call would
 * fall back to the OS preference and an inheriting app inside Telegram would show
 * the wrong theme.
 *
 * `themeParams.bindCssVars()` publishes `--tg-theme-*` on <html> and keeps them in
 * sync; useTelegramTheme only published them once, which left the inherit mode on
 * the static fallback palette.
 */
export function useThemeController(): void {
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

  // The Settings screen announces explicit changes through this event.
  useEffect(() => {
    const handler = () => setManual(readManual());
    window.addEventListener(THEME_CHANGE_EVENT, handler);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, handler);
  }, []);

  useEffect(() => {
    applyThemeChoice(toChoice(manual), inTelegram ? telegramIsDark : undefined);
  }, [manual, inTelegram, telegramIsDark, osIsDark]);
}

/** Event name shared with the Settings screen. */
export const THEME_CHANGE_EVENT = 'lx-theme-change';
