import { hapticFeedback, isTMA } from '@telegram-apps/sdk-react';

export type ImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
export type NotifyType = 'error' | 'success' | 'warning';

/**
 * Haptic helpers for Telegram Mini Apps.
 *
 * SDK v3 note: `hapticFeedback` has no `mount()` and its methods are safe-wrapped,
 * so each call is guarded with `isAvailable()` and a try/catch.
 * Both helpers are no-ops in a plain browser (Web mode) and never throw.
 */
export function impact(style: ImpactStyle = 'light'): void {
  if (!isTMA()) return;
  try {
    if (hapticFeedback.impactOccurred.isAvailable()) {
      hapticFeedback.impactOccurred(style);
    }
  } catch {
    // Haptics are best-effort: a failed vibration must never break the quiz flow.
  }
}

export function notify(type: NotifyType): void {
  if (!isTMA()) return;
  try {
    if (hapticFeedback.notificationOccurred.isAvailable()) {
      hapticFeedback.notificationOccurred(type);
    }
  } catch {
    // Haptics are best-effort.
  }
}
