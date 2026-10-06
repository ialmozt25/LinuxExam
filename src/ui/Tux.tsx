/**
 * Tux the Penguin — маскот LinuxExam. Заменяет эмодзи-огонёк в streak-бейдже
 * Dashboard (tux-streak).
 *
 * Ассет — `public/tux.svg`, BW-вариант из github.com/garrett/Tux: оригинал
 * Larry Ewing (GIMP, 1996), вектор Garrett LeSage (Inkscape), доработка
 * IFo Hancroft; CC0 / Public Domain. BW выбран для кегля 24px: чёрно-белый
 * контур масштабируется вниз чище цветного (kernel.org, «BW scale down better»).
 *
 * Изображение декоративное: `alt=""` + `aria-hidden` — смысл несут соседние
 * узлы бейджа (число серии и подпись), а не картинка. В тёмной теме BW-контур
 * инвертируется правилом в `src/index.css`.
 *
 * Размер задаётся в CSS-пикселях через `width`/`height`; ассет несёт `viewBox`,
 * поэтому SVG масштабируется равномерно и не искажается.
 */
export function Tux({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/tux.svg"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={className}
      data-testid="tux"
    />
  );
}
