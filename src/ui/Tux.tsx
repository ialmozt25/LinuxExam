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
 *
 * Путь собирается из `import.meta.env.BASE_URL`, а НЕ пишется как `/tux.svg`:
 * Vite переписывает абсолютные пути только в `index.html`, но не строковые
 * литералы в `.tsx`. Сборка прода идёт с `VITE_BASE=/LinuxExam/`
 * (`.github/workflows/deploy.yml`), поэтому жёсткий `/tux.svg` уезжал на
 * `https://ialmozt25.github.io/tux.svg` → 404 и бейдж показывал битую картинку.
 * `BASE_URL` равен `/LinuxExam/` на проде и `/` на локальных стендах, то есть
 * одна и та же строка кода верна в обоих окружениях.
 */
export function Tux({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}tux.svg`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={className}
      data-testid="tux"
    />
  );
}
