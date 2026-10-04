#!/usr/bin/env node
/**
 * .project/drafts/_expand-checklist.mjs — генератор 31 нового критерия для
 * `.project/checklists/ui-ux.yaml`: 30 (spec 077) → **61** (spec 080, PART 2.1).
 *
 * Почему генератором, а не правкой руками: критерий — запись из шести
 * обязательных полей плюс блок check-специфичных вложенных полей, и `check.mjs`
 * падает на первой же опечатке отступа. Скрипт печатает готовый YAML-фрагмент,
 * который дописывается в конец `criteria:`; существующие 30 записей не
 * переписываются ни на байт — их текст и порядок это история проверок (spec 077).
 *
 * Раскладка A–F задания (12/8/12/8/6/5 = 51 позиция состава) ложится на
 * существующие 30 записей spec 077 так, что новых критериев ровно 31:
 *
 *   A. LAYOUT (12) — LAYOUT-001..008 · TYPO-001 (body ≥ 16px) ·
 *                    TYPO-002 (lh ≥ 1.4) · TYPO-003 (≤ 8 размеров) ·
 *                    SPACE-003 (нет 13/17/22px) · SPACE-002 (8px-grid);
 *                    + **новые** TYPO-006 (lh ≤ 1.6) и SPACE-005 (4px-grid)
 *   B. COLOR (8)  — COLOR-001..006 + **новый** COLOR-007 (роли радиусов);
 *                   8-я позиция состава — COLOR-005
 *   C. USABILITY (12) — все новые (Нильсен)
 *   D. COPY (8)   — COPY-001..003 + **новые** COPY-004..008
 *   E. MARKETING (6) — все новые
 *   F. TMA (5)    — все новые
 *
 * Три записи сознательно перекрываются с существующими — каждая объявляет свою
 * ось в `note:` и служит контролем измерителя (USABILITY-focusvisible /
 * STATE-003, USABILITY-onecta / LAYOUT-003, USABILITY-states / STATE-001).
 *
 * Запуск: node .project/drafts/_expand-checklist.mjs [--count]
 */

const blocks = [];

function c(id, title, check, threshold, source, extra = []) {
  blocks.push(
    [
      `  - id: ${id}`,
      `    title: ${title}`,
      `    check: ${check}`,
      `    threshold: ${threshold}`,
      `    status: unknown`,
      `    source: ${source}`,
      ...extra,
      '',
    ].join('\n'),
  );
}

const GR = '    grep:';

/* ═══════════════ A. LAYOUT: типографика и сетка (2 новых) ═══════════════ */

c('TYPO-006', 'Межстрочный интервал не больше 1.6', 'grep',
  'совпадений 0', 'WCAG 2.2', [
    GR,
    "      pattern: 'lineHeight:\\s*[^;\\n]{0,3}(?<![\\d.])(?:1\\.[7-9]|[2-9]\\d*|\\d\\d+)\\s*[,;}]'",
    "      include: ['.ts', '.tsx', '.css']",
    '      note: TYPO-002 держит нижнюю границу (>= 1.4), этот критерий — верхнюю (<= 1.6). Lookbehind (?<![\\d.]) обязателен: без него «1.4» матчится хвостом [2-9] на цифре 4, а «lineHeight: 24» (пиксели, не ratio) ловится веткой \\d\\d+',
  ]);

c('SPACE-005', 'Горизонтальные отступы кратны 4px', 'grep',
  'совпадений 0', 'Apple HIG', [
    GR,
    "      pattern: '(?:paddingLeft|paddingRight|paddingInline[A-Za-z]*|marginLeft|marginRight|marginInline[A-Za-z]*|columnGap)\\s*:\\s*[^0-9\\n]{0,3}(?:2|6|10|14|18)px'",
    "      include: ['.ts', '.tsx']",
    '      note: SPACE-001 меряет кратность 4 по всем отступам; этот критерий закрывает горизонтальную ось — значения 2/6/10/14/18px, которые на компактных бейджах проскакивают мимо 4px-сетки',
  ]);

/* ══════════════════════════════ B. COLOR (+1) ══════════════════════════════ */

c('COLOR-007', 'Радиусы берутся из токенов var(--radius-*)', 'grep',
  'совпадений > 0', 'Apple HIG', [
    GR,
    "      pattern: 'var\\(--(?:radius|card-radius|btn-primary-radius)'",
    "      include: ['.ts', '.tsx', '.css']",
    '      expect: match',
    '      note: отдельная ось от COLOR-005 (тот меряет мощность литеральных значений, этот — сам факт токенизации радиуса)',
  ]);

/* ═══════════════════════════ C. USABILITY (+12, Нильсен) ═══════════════════════════ */

c('USABILITY-loading', 'Состояние загрузки показано пользователю', 'grep',
  'совпадений > 0', 'Nielsen', [
    GR,
    "      pattern: 'Loading|Skeleton|Загрузк|загрузк'",
    "      include: ['.ts', '.tsx']",
    '      expect: match',
  ]);

c('USABILITY-realworld', 'Язык интерфейса совпадает с языком пользователя', 'grep',
  'совпадений 0', 'Nielsen', [
    GR,
    "      pattern: '>[A-Za-z][A-Za-z ]{6,}<'",
    "      include: ['.tsx']",
    '      note: латинский БРЕНД внутри выражения не считается — паттерн ловит литеральный текст между тегами',
  ]);

c('USABILITY-control', 'У пользователя есть выход из потока (отмена / назад)', 'grep',
  'совпадений > 0', 'Nielsen', [
    GR,
    "      pattern: 'Отмен|отмен|Назад|back-to-|onBack'",
    "      include: ['.ts', '.tsx']",
    '      expect: match',
  ]);

c('USABILITY-consistency', 'Кнопки описаны ролями (--btn-*), а не набором свойств', 'grep',
  'совпадений > 0', 'Nielsen', [
    GR,
    "      pattern: '--btn-|btn-primary|btn-secondary'",
    "      include: ['.ts', '.tsx', '.css']",
    '      expect: match',
    '      note: COLOR-006 — про источник ЦВЕТА; этот критерий про то, что кнопка собрана из ролей',
  ]);

c('USABILITY-errorprevent', 'Необратимые действия требуют подтверждения', 'grep',
  'совпадений > 0', 'Nielsen', [
    GR,
    "      pattern: 'confirm|Подтверд|подтверд'",
    "      include: ['.ts', '.tsx']",
    '      expect: match',
  ]);

c('USABILITY-recognition', 'Подсказки на месте: не нужно припоминать', 'grep',
  'совпадений > 0', 'Nielsen', [
    GR,
    "      pattern: 'hint|Hint|подсказк|Подсказк'",
    "      include: ['.ts', '.tsx']",
    '      expect: match',
  ]);

c('USABILITY-onecta', 'Одно главное действие на экран', 'manual',
  'на каждом из 19 baseline-экранов ровно один первичный CTA', 'Nielsen', [
    '    note: LAYOUT-003 проверяет, что CTA влезает во вьюпорт; этот критерий — что он один',
  ]);

c('USABILITY-choices', 'Не больше 5 вариантов выбора в одном блоке', 'vision',
  'вариантов в блоке <= 5 (правило Миллера)', 'Nielsen');

c('USABILITY-feedback', 'Действие даёт обратную связь (aria-live / haptic)', 'grep',
  'совпадений > 0', 'Nielsen', [
    GR,
    "      pattern: 'aria-live|aria-busy|haptic|Haptic'",
    "      include: ['.ts', '.tsx']",
    '      expect: match',
  ]);

c('USABILITY-emptystates', 'Пустые состояния объясняют и предлагают действие', 'vision',
  'на 19 экранах нет «пустоты без объяснения и без действия» (аудит PNG)', 'Nielsen', [
    '    note: STATE-004 проверяет наличие CTA у empty state; этот критерий — что состояние вообще распознаётся на снимке',
  ]);

c('USABILITY-focusvisible', 'Видимая фокус-рамка не отключена', 'grep',
  'совпадений 0', 'WCAG 2.2', [
    GR,
    "      pattern: 'outline:\\s*[^;\\n]{0,3}none'",
    "      include: ['.ts', '.tsx', '.css']",
    '      note: как STATE-003, но с нормализацией пробелов: паттерн STATE-003 пропускает «outline: none» с двумя пробелами после двоеточия',
  ]);

c('USABILITY-states', 'Состояния элемента различимы (hover / active / disabled)', 'grep',
  'совпадений > 0', 'Nielsen', [
    GR,
    "      pattern: ':hover|:active|disabled='",
    "      include: ['.ts', '.tsx', '.css']",
    '      expect: match',
    '      note: STATE-001 — про наличие disabled у кнопок через пробу; этот критерий проверяет, что состояния вообще описаны в разметке/стилях',
  ]);

/* ══════════════════════════════ D. COPY (+5) ══════════════════════════════ */

c('COPY-004', 'Кнопка называет действие (глагол + объект)', 'grep',
  'совпадений > 0', 'Nielsen', [
    GR,
    "      pattern: '>\\s*(?:Начать|Продолжить|Ответить|Завершить|Открыть|Попробовать|Выбрать)[^<]*<'",
    "      include: ['.tsx']",
    '      expect: match',
  ]);

c('COPY-005', 'В UI нет служебных заглушек (TODO / lorem)', 'grep',
  'совпадений 0', 'Nielsen', [
    GR,
    "      pattern: '>[^<]*(?:TODO|FIXME|lorem ipsum|Lorem ipsum)[^<]*<'",
    "      include: ['.tsx']",
  ]);

c('COPY-006', 'У ошибки есть путь восстановления', 'grep',
  'совпадений > 0', 'Nielsen', [
    GR,
    "      pattern: 'Попроб|попроб|Повторит|повторит|Ещё раз|ещё раз'",
    "      include: ['.ts', '.tsx']",
    '      expect: match',
  ]);

c('COPY-007', 'Тон текста не винит пользователя', 'grep',
  'совпадений 0', 'Nielsen', [
    GR,
    "      pattern: 'Вы не (?:ввели|должны)|You (?:failed|entered)|Неверный ввод|Ошибочный ввод'",
    "      include: ['.ts', '.tsx']",
    '      note: как COPY-002, но с явным списком формулировок обвинения вместо подстроки «Вы ввели»',
  ]);

c('COPY-008', 'Один термин на одно понятие', 'manual',
  'в UI одна лексема на сущность (вопрос / прогон / экзамен)', 'Nielsen');

/* ════════════════════════════ E. MARKETING (+6) ════════════════════════════ */

c('MARKETING-001', 'Заголовок объясняет продукт, а не приветствует', 'vision',
  'headline читается за 3 секунды (аудит PNG)', 'internal');

c('MARKETING-002', 'Ценность считывается за 5 секунд', 'vision',
  'на первом экране ясно, что получит пользователь', 'internal');

c('MARKETING-003', 'CTA называет результат, а не шаг навигации', 'vision',
  'CTA формулирует выгоду, а не «Продолжить»', 'Nielsen');

c('MARKETING-004', 'Есть социальное доказательство', 'vision',
  'число пользователей / отзыв / рейтинг видны на экране', 'internal');

c('MARKETING-005', 'Снято ключевое возражение (цена / время / сложность)', 'vision',
  'рядом с CTA есть снятие возражения', 'internal');

c('MARKETING-006', 'Иерархия: один главный визуальный акцент на экран', 'vision',
  'на экране один «первый взгляд»', 'internal');

/* ════════════════════════════════ F. TMA (+5) ════════════════════════════════ */

c('TMA-001', 'Используются themeParams Telegram (--tg-theme-*)', 'grep',
  'совпадений > 0', 'TMA docs', [
    GR,
    "      pattern: '--tg-theme-'",
    "      include: ['.ts', '.tsx', '.css']",
    '      expect: match',
  ]);

c('TMA-002', 'Высота приложения по visual viewport', 'grep',
  'совпадений > 0', 'TMA docs', [
    GR,
    "      pattern: 'visualViewport|100dvh|--app-height'",
    "      include: ['.ts', '.tsx', '.css']",
    '      expect: match',
  ]);

c('TMA-003', 'Учтён MainButton (или осознанно не используется)', 'grep',
  'совпадений > 0', 'TMA docs', [
    GR,
    "      pattern: 'MainButton|mainbutton|--mainbutton-'",
    "      include: ['.ts', '.tsx', '.css']",
    '      expect: match',
  ]);

c('TMA-004', 'Учтены safe-area inset сверху и снизу', 'grep',
  'совпадений > 0', 'Apple HIG', [
    GR,
    "      pattern: '--safe-(?:top|bottom)'",
    "      include: ['.ts', '.tsx', '.css']",
    '      expect: match',
  ]);

c('TMA-005', 'Мобильный вьюпорт без горизонтальной прокрутки', 'playwright',
  'rootOverflowX <= 1 на mobile-вьюпортах', 'TMA docs', [
    '    probe:',
    '      field: rootOverflowX',
    '      note: LAYOUT-001 смотрит весь набор вьюпортов; этот критерий — мобильный срез 390x844',
  ]);

if (process.argv.includes('--count')) {
  const ids = blocks.map((b) => /- id:\s*(\S+)/.exec(b)[1]);
  console.log(JSON.stringify({ added: ids.length, total: 30 + ids.length, ids }, null, 2));
} else {
  console.log(blocks.join('\n'));
}
