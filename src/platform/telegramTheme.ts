/**
 * SDK-free bridge for the Telegram colour scheme.
 *
 * `@telegram-apps/sdk-react` is ~17 kB gzip and must not sit in the initial chunk,
 * so it is reached only through the dynamic import in main.tsx / telegram_adapter.
 * This module carries the small amount of Telegram state the theme controller needs
 * without importing the SDK itself: the adapter publishes into it, and
 * `useThemeController` reads it through `useSyncExternalStore`.
 */

export interface TelegramThemeState {
  /** True inside a Telegram Mini App (the SDK's `isTMA()`). */
  inTMA: boolean;
  /**
   * Telegram's colour scheme. `undefined` means "no trustworthy signal" and must
   * not be read as 'dark' (same strictness as the SDK Computed it comes from).
   */
  isDark: boolean | undefined;
}

const INITIAL: TelegramThemeState = { inTMA: false, isDark: undefined };

let state: TelegramThemeState = INITIAL;
const listeners = new Set<() => void>();

/**
 * Current snapshot. Returns the SAME object until something actually changes, which
 * is what `useSyncExternalStore` requires to avoid an endless re-render loop.
 */
export function getTelegramThemeState(): TelegramThemeState {
  return state;
}

export function subscribeTelegramTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called by the SDK adapter (and by its themeParams.isDark subscription). */
export function publishTelegramTheme(next: TelegramThemeState): void {
  if (next.inTMA === state.inTMA && next.isDark === state.isDark) return;
  state = next;
  for (const listener of [...listeners]) listener();
}
