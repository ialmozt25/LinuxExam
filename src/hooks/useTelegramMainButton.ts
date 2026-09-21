import { useEffect, useRef } from 'react';
import { isTMA, mainButton } from '@telegram-apps/sdk-react';

/**
 * Mirrors the Telegram MainButton with an in-app button.
 *
 * SDK v3 note: `mainButton` has no `setText`/`show`/`hide`/`enable`/`disable`.
 * Text and state are applied through a single `mainButton.setParams({ text, isVisible, isEnabled })`.
 * The callback is kept in a ref so an inline arrow does not re-run the effect.
 *
 * No-op outside Telegram and never throws: every SDK call is guarded.
 */
export function useTelegramMainButton(
  text: string,
  onClick: () => void,
  enabled = true,
  visible = true
): void {
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  useEffect(() => {
    if (!isTMA()) return;

    const handler = () => onClickRef.current();
    let registered = false;

    try {
      if (typeof mainButton.isMounted === 'function' && !mainButton.isMounted()) return;
      mainButton.setParams({ text, isVisible: visible, isEnabled: enabled });
      mainButton.onClick(handler);
      registered = true;
    } catch (e) {
      console.warn('mainButton setup failed:', e);
    }

    return () => {
      if (!registered) return;
      try {
        mainButton.offClick(handler);
        mainButton.setParams({ isVisible: false });
      } catch (e) {
        console.warn('mainButton teardown failed:', e);
      }
    };
  }, [text, enabled, visible]);
}
