import { useEffect } from 'react';
import { isTMA, themeParams } from '@telegram-apps/sdk-react';

/**
 * Applies Telegram Mini App theme parameters to the document root as CSS variables.
 *
 * SDK v3 API choice (both exist in the installed @telegram-apps/sdk-react v3):
 * `themeParams.state` is a `Computed<Partial<Record<string, `#${string}`>>>` which is
 * callable, and the package also exports `useSignal(signal)`. This hook uses the
 * direct call `themeParams.state()` because the requirement is a single read on
 * mount; `useSignal` would additionally subscribe and re-render on every theme
 * change, which the screens do not need.
 *
 * State keys arrive camelCased from the SDK (bgColor, secondaryBgColor, textColor,
 * hintColor, buttonColor, ...) and are published as `--tg-theme-<kebab-case>`, so
 * the CSS_VARS aliases in the theme resolve.
 *
 * The hook is a no-op outside Telegram (no launch params) and never throws: when
 * the API is missing it logs a warning and returns, leaving the static :root
 * fallbacks from index.css in place.
 */
export function useTelegramTheme(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isTMA()) return;

    const readState = themeParams.state;
    if (typeof readState !== 'function') {
      console.warn('useTelegramTheme: themeParams.state is not available in this SDK build');
      return;
    }

    let params: Partial<Record<string, string>>;
    try {
      params = readState();
    } catch (e) {
      console.warn('useTelegramTheme: failed to read themeParams.state', e);
      return;
    }
    if (!params) return;

    const root = document.documentElement;
    for (const [key, value] of Object.entries(params)) {
      if (typeof value !== 'string' || value.length === 0) continue;
      root.style.setProperty('--tg-theme-' + toKebabCase(key), value);
    }
  }, []);
}

/** camelCase -> kebab-case: secondaryBgColor -> secondary-bg-color. */
export function toKebabCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}