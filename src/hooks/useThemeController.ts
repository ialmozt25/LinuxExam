import { useEffect, useState } from 'react';
import { isTMA, themeParams, useSignal } from '@telegram-apps/sdk-react';
import { applyThemeChoice, getFollowSystem, readManualChoice, type ThemeChoice } from '@/utils/theme';

const MEDIA_QUERY = '(prefers-color-scheme: dark)';

function readOsIsDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia(MEDIA_QUERY).matches;
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
 * `themeParams.bindCssVars()` is called once on mount. It publishes `--tg-theme-*`
 * on <html> and keeps them in sync on later theme changes. useTelegramTheme does a
 * one-shot publish only; without the live binding the inherit mode would fall back
 * to the static #1E1E1E palette.
 */
export function useThemeController(): void {
  const inTelegram = isTMA();

  // Subscribing through the SDK hook rather than reading the signal inline: the
  // component must re-render when Telegram flips its color scheme.
  const telegramIsDark = useSignal(themeParams.isDark);

  const [osIsDark, setOsIsDark] = useState<boolean>(readOsIsDark);
  const [choice, setChoice] = useState<ThemeChoice>(() =>
    getFollowSystem() ? 'system' : readManualChoice()
  );

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
    const handler = () => setChoice(getFollowSystem() ? 'system' : readManualChoice());
    window.addEventListener(THEME_CHANGE_EVENT, handler);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, handler);
  }, []);

  useEffect(() => {
    applyThemeChoice(choice);
  }, [choice, inTelegram, telegramIsDark, osIsDark]);
}

/** Event name shared with the Settings screen. */
export const THEME_CHANGE_EVENT = 'lx-theme-change';
