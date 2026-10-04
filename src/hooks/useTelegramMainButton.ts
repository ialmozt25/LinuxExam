import { useEffect, useRef } from 'react';
import { isTMA, mainButton, useSignal } from '@telegram-apps/sdk-react';

/**
 * Mirrors the Telegram MainButton with an in-app button.
 *
 * SDK v3 note: `mainButton` has no `setText`/`show`/`hide`/`enable`/`disable`.
 * Text and state are applied through a single `mainButton.setParams({ text, isVisible, isEnabled })`,
 * and every method is `SafeWrapped`: `method.isAvailable()` — это сигнал «среда TMA +
 * SDK инициализирован + компонент MainButton смонтирован».
 *
 * spec 072: setup больше не «всё или ничего». Раньше единый try/catch глушил
 * исключение и оставлял и `setParams`, и `onClick` невыполненными — кнопка не
 * показывалась, а след терялся в `console.warn` (в TMA in-app футера нет, поэтому
 * CTA исчезал целиком). Теперь части настраиваются независимо, а повторная попытка
 * делается при монтировании MainButton.
 *
 * No-op outside Telegram and never throws: every SDK call is guarded.
 */

/** Доступен ли нативный MainButton прямо сейчас (TMA + SDK init + монтирование). */
export function isMainButtonAvailable(): boolean {
  try {
    return mainButton.setParams.isAvailable();
  } catch {
    return false;
  }
}

/**
 * Реактивная доступность MainButton: пере-рендер при монтировании кнопки.
 *
 * `mainButton.setParams.isAvailable` — computed-сигнал SDK, поэтому подписка на
 * него даёт обновление и при позднем монтировании, и при выходе из строя.
 */
export function useMainButtonAvailable(): boolean {
  const mounted = useSignal(mainButton.isMounted);
  void mounted;
  return isTMA() && isMainButtonAvailable();
}

export function useTelegramMainButton(
  text: string,
  onClick: () => void,
  enabled = true,
  visible = true
): void {
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  // `mainButton.isMounted` — Computed-сигнал SDK: подписка пересобирает эффект,
  // когда MainButton появляется позже (mount мог ещё не завершиться на первом
  // рендере). Без этого единственная попытка настройки терялась навсегда.
  const isMounted = useSignal(mainButton.isMounted);

  useEffect(() => {
    if (!isTMA()) return;

    const handler = () => onClickRef.current();
    let clickRegistered = false;

    // 1. Клик — отдельно и ДО setParams: провал настройки текста/видимости не
    //    должен оставлять кнопку без обработчика.
    try {
      mainButton.onClick(handler);
      clickRegistered = true;
    } catch (e) {
      console.warn('mainButton onClick failed:', e);
    }

    // 2. Состояние — своей попыткой; ошибка SDK не отменяет п.1.
    try {
      mainButton.setParams({ text, isVisible: visible, isEnabled: enabled });
    } catch (e) {
      console.warn('mainButton setParams failed:', e);
    }

    return () => {
      // Порядок обратный настройке: сначала снять обработчик, потом скрыть —
      // иначе кнопка остаётся видимой без действия.
      if (clickRegistered) {
        try {
          mainButton.offClick(handler);
        } catch (e) {
          console.warn('mainButton offClick failed:', e);
        }
      }
      try {
        mainButton.setParams({ isVisible: false });
      } catch (e) {
        console.warn('mainButton teardown failed:', e);
      }
    };
    // `isMounted` в deps: при монтировании кнопки попытка повторяется.
  }, [text, enabled, visible, isMounted]);
}
