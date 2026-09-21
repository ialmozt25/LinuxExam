import { useEffect, useRef } from 'react';
import { backButton, isTMA } from '@telegram-apps/sdk-react';

/**
 * Mirrors an in-app "back" control with the Telegram BackButton.
 *
 * SDK v3 note: `backButton` exposes `mount`/`isMounted`/`show`/`hide`/`onClick`/`offClick`
 * as safe-wrapped calls; `isMounted` and `isVisible` are signals (callable).
 * The callback is kept in a ref so an inline arrow does not re-run the effect.
 *
 * No-op outside Telegram and never throws.
 */
export function useTelegramBackButton(onBack: () => void, enabled = true): void {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!isTMA()) return;

    const handler = () => onBackRef.current();
    let registered = false;

    try {
      if (typeof backButton.isMounted === 'function' && !backButton.isMounted()) return;
      if (enabled) {
        backButton.show();
      } else {
        backButton.hide();
      }
      backButton.onClick(handler);
      registered = true;
    } catch (e) {
      console.warn('backButton setup failed:', e);
    }

    return () => {
      if (!registered) return;
      try {
        backButton.offClick(handler);
        backButton.hide();
      } catch (e) {
        console.warn('backButton teardown failed:', e);
      }
    };
  }, [enabled]);
}
