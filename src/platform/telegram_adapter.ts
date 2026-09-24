import {
  init,
  isTMA,
  backButton,
  mainButton,
  viewport,
  themeParams,
  miniApp,
  initData,
  swipeBehavior,
  shareURL,
} from '@telegram-apps/sdk-react';
import { publishTelegramTheme } from './telegramTheme';

/**
 * Thin wrapper around the official Telegram Mini Apps SDK (@telegram-apps/sdk-react v3).
 *
 * API notes for SDK v3 (the API in the original spec does not match the installed
 * package, so the calls below use the real exports):
 * - `isTMA('simple')` does not exist; the sync `isTMA()` is the non-strict check.
 * - `initData` has no `mount()`; it is initialised with `initData.restore()`.
 * - `viewport.disableVerticalSwipes` does not exist; it lives in the `swipeBehavior` scope as `disableVertical`.
 * - `mainButton` has no `setText`/`show`/`hide`/`enable`/`disable`; text and state are set
 *   through `mainButton.setParams({ text, isVisible, isEnabled })`.
 * - `hapticFeedback` exposes no `mount()` at all, so there is nothing to mount for it.
 * All wrapped calls are guarded with `.isAvailable()` per the SDK documentation.
 */
export async function initTelegramSDK(): Promise<void> {
  if (!isTMA()) {
    console.log('Not in Telegram — running in browser mode');
    return;
  }
  try {
    init();

    if (backButton.mount.isAvailable()) {
      backButton.mount();
    }
    if (mainButton.mount.isAvailable()) {
      mainButton.mount();
    }
    if (themeParams.mount.isAvailable()) {
      await themeParams.mount();
    }

    // Hand the colour scheme to the SDK-free bridge (src/platform/telegramTheme.ts)
    // and keep it in sync, so useThemeController can follow the Telegram palette
    // without pulling the SDK into the initial chunk.
    publishTheme();
    themeParams.isDark.sub(() => publishTheme());
    bindThemeCssVars();

    if (miniApp.mount.isAvailable()) {
      await miniApp.mount();
    }
    initData.restore();

    if (viewport.mount.isAvailable()) {
      await viewport.mount();
      if (viewport.expand.isAvailable()) {
        viewport.expand();
      }
    }

    if (miniApp.ready.isAvailable()) {
      miniApp.ready();
    }
    if (swipeBehavior.mount.isAvailable()) {
      swipeBehavior.mount();
    }
    if (swipeBehavior.disableVertical.isAvailable()) {
      swipeBehavior.disableVertical();
    }

    document.body.style.overscrollBehavior = 'none';
  } catch (e) {
    console.warn('Telegram SDK init failed:', e);
  }
}

/**
 * Reads `themeParams.isDark` defensively: an unmounted Computed yields undefined,
 * which the theme bridge deliberately does NOT read as 'dark'.
 */
function readTelegramIsDark(): boolean | undefined {
  try {
    const value = themeParams.isDark();
    return value === true ? true : value === false ? false : undefined;
  } catch {
    return undefined;
  }
}

/** Publishes the current Telegram colour scheme into the SDK-free bridge. */
function publishTheme(): void {
  publishTelegramTheme({ inTMA: true, isDark: readTelegramIsDark() });
}

/**
 * Publishes `--tg-theme-*` on <html> and keeps them in sync. The
 * [data-theme-source="inherit"] block in tokens.css consumes them. Moved here from
 * useThemeController when the SDK left the initial chunk: binding is an SDK concern,
 * and doing it at init means the variables exist before React's first paint.
 */
function bindThemeCssVars(): void {
  const bind = themeParams.bindCssVars;
  if (typeof bind !== 'function') return;
  try {
    if (typeof bind.isAvailable === 'function' && !bind.isAvailable()) return;
    bind();
  } catch {
    // Already bound, or not mounted: existing variables stay in place.
  }
}

export function isTelegramWebApp(): boolean {
  return typeof window !== 'undefined' && isTMA();
}

export function getTelegramUser(): { first_name?: string; username?: string } | null {
  if (!isTelegramWebApp()) return null;
  try {
    return initData.user() ?? null;
  } catch {
    return null;
  }
}

export function getRawInitData(): string {
  if (!isTelegramWebApp()) return '';
  try {
    return initData.raw() ?? '';
  } catch {
    return '';
  }
}

/**
 * Shares a result link.
 *
 * Inside Telegram this goes through the SDK's `shareURL` (Telegram Share Links),
 * because `window.open` is blocked in the iOS Telegram WebView. Outside Telegram,
 * or when the SDK method is unavailable, it falls back to opening the t.me share
 * link in a new tab.
 */
export function shareResult(url: string, text: string): void {
  if (isTMA()) {
    try {
      if (typeof shareURL === 'function' && shareURL.isAvailable?.() !== false) {
        shareURL(url, text);
        return;
      }
    } catch (e) {
      console.warn('shareURL failed:', e);
    }
  }
  window.open(
    'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text),
    '_blank',
    'noopener,noreferrer'
  );
}
