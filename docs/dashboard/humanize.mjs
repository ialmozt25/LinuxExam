/**
 * humanize.mjs — перевод технических префиксов коммитов на человеческий язык.
 *
 * V7: вынесено из dashboard.js, чтобы функция была покрыта unit-тестами
 * (чистая функция без DOM).
 */

export function humanizeCommit(msg) {
  if (!msg) return "";
  return String(msg)
    .replace(/^feat\(bank\):\s*/i, "Добавлены вопросы: ")
    .replace(/^docs\(project\):\s*/i, "Документация: ")
    .replace(/^feat\(dashboard\):\s*/i, "Дашборд: ")
    .replace(/^feat\(tools\):\s*/i, "Инструменты: ")
    .replace(/^fix\(parser\):\s*/i, "Исправление: ")
    .replace(/^chore\(repo\):\s*/i, "Обслуживание: ");
}
