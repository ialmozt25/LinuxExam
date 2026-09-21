import {
  init,
  isTMA,
  backButton,
  viewport,
  themeParams,
  miniApp,
  initData,
  swipeBehavior,
} from '@telegram-apps/sdk-react';

/**
 * Thin wrapper around the official Telegram Mini Apps SDK (@telegram-apps/sdk-react v3).
 *
 * API notes for SDK v3 (the API in the original spec does not match the installed
 * package, so the calls below use the real exports):
 * - `isTMA('simple')` does not exist; the sync `isTMA()` is the non-strict check.
 * - `initData` has no `mount()`; it is initialised with `initData.restore()`.
 * - `viewport.disableVerticalSwipes` does not exist; it lives in the `swipeBehavior` scope as `disableVertical`.
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
    if (themeParams.mount.isAvailable()) {
      await themeParams.mount();
    }
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
