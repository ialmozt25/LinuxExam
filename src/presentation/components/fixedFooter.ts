import { useLayoutEffect, useRef } from 'react';

/**
 * Резерв высоты fixed-футера (spec 070).
 *
 * Футер кнопок действия переведён со `sticky` на `fixed` (sticky липнет к низу
 * scroll-контейнера и на живом мобильном оказывается вне экрана — FIX A spec 067
 * на устройстве не сработал). `fixed`-элемент выведен из потока, поэтому
 * скролл-контейнер обязан сам зарезервировать снизу его высоту — иначе последний
 * абзац объяснения уезжает под футер.
 */

/** z-index футера: выше контента (10) и DailyGoalPicker (40), ниже DEV-бейджа (9999). */
export const FIXED_FOOTER_Z_INDEX = 50;

/** Высота футера в CSS-переменной на контейнере-родителе (`ScreenContainer`). */
export const FOOTER_HEIGHT_VAR = '--fixed-footer-h';

/**
 * Распорка под фиксированный футер: реальный флекс-ребёнок высотой с футер.
 *
 * Почему не `padding-bottom` на скролл-контейнере: у `div` с `flex: 1` и
 * `overflow-y: auto` padding в `scrollHeight` не попадает (замерено в Chromium:
 * 390×844, контейнер 844px, отступ 119px — `scrollHeight` равен сумме детей,
 * 1404px вместо 1405+119). Нижний отступ поэтому не давал доскроллить контент из
 * под футера. Отдельный элемент в потоке удлиняет скролл гарантированно.
 *
 * Высота = высота футера + остаточный отступ контейнера (`--space-4`, 16px):
 * футер перекрывает и padding-box, а не только контент. Без добавки карточка
 * объяснения на максимальной прокрутке заходит под футер на величину отступа
 * (замерено: 4px при 390×844).
 *
 * Фолбэк 136px (= 120 + 16) — оценка для не измеренного футера (desktop ≈ 89px);
 * после монтирования переменная заменяет её фактической высотой.
 */
export const FIXED_FOOTER_SPACER = {
  flexShrink: 0,
  height: `calc(var(${FOOTER_HEIGHT_VAR}, 120px) + var(--space-4))`,
  pointerEvents: 'none',
} as const;

/**
 * Измеряет футер и публикует его высоту как `--fixed-footer-h` на родителе.
 *
 * Фактическая высота, а не константа: она зависит от safe-area, длины подписи
 * кнопки и (в ExamRun) от наличия второй кнопки. Возвращаемый ref вешается на
 * внешний узел футера; `ScreenContainer` обязан быть его прямым родителем.
 *
 * `ResizeObserver` недоступен в jsdom — там остаётся однократный замер.
 */
export function useFixedFooterPadding() {
  const footerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const footer = footerRef.current;
    const container = footer?.parentElement ?? null;
    if (!footer || !container) return;

    const set = () => container.style.setProperty(FOOTER_HEIGHT_VAR, `${footer.offsetHeight}px`);
    set();

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(set);
      observer.observe(footer);
    }

    return () => {
      observer?.disconnect();
      // Футер размонтирован (например, вошли в Telegram-режим) — резерв снят.
      container.style.setProperty(FOOTER_HEIGHT_VAR, '0px');
    };
  }, []);

  return footerRef;
}
