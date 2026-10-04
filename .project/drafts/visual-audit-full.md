# Визуальный аудит 19 baseline PNG — spec 080, PART 2.2

**Дата:** 2026-10-04 · **Стенд:** preview-сборка (`stand-prod`, :4173) ·
**Снимки:** `e2e/visual-regression.spec.ts-snapshots/*-win32.png` (19 шт., commit `99962da`/spec 078)

## Режим аудита: VISION UNAVAILABLE → программный анализ

`read_image` на всех 19 PNG возвращает

```
LlmError: no adapter registered for provider "codex-local"
```

— тот же дефект, что зафиксирован в `log.md` для spec 077 («vision недоступен
(codex-local без адаптера) — аудит программный»). Задание явно разрешает этот
путь: *«Vision недоступен → программ. анализ (DOM+grep), пометить»*. Поэтому
утверждения ниже — **измерения**, а не впечатления, и каждое сопровождено
командой, которой его можно воспроизвести.

| инструмент | что даёт | файл |
|---|---|---|
| `sharp` (transitive playwright) | палитра, площадь артефактов, bbox, поля, полосы | `.project/drafts/_audit-png.mjs` |
| Playwright + `getBoundingClientRect`/`getComputedStyle` на 19 состояниях | реальные размеры целей и типографика | `.project/drafts/_audit-measure.spec.ts` |
| `axe-core` (WCAG 2.1 AA) | контраст | `.project/drafts/a11y-baseline.json` |
| проба вёрстки spec 075 | overflow / touch / CTA / clip | `.project/drafts/layout-probe-075.json` |
| `grep` по `src/presentation/**` | хардкод значений | `npm run check` |

Сырые данные: `.project/drafts/_visual-audit-data.json` (пиксели),
`.project/drafts/_visual-audit-dom.json` (DOM).

---

## 1. Пиксельный слой: 19 снимков, измеренные факты

| экран / viewport | bbox | поля L/R/T/B | плотность контента | маджента |
|---|---|---|---|---|
| analytics-desktop 1440×900 | 1408×785 @16,44 | 16/16/44/71 | 0.592 | 0 |
| analytics-mobile 390×844 | 358×785 @16,44 | 16/16/44/15 | 0.632 | 0 |
| dashboard-desktop 1440×900 | 1408×863 @16,29 | 16/16/29/8 | 0.514 | 0 |
| dashboard-mobile 390×844 | 358×807 @16,29 | 16/16/29/8 | 0.499 | 0 |
| exam-results-desktop 1440×900 | 1440×848 @0,44 | **0/0**/44/8 | 0.369 | 0 |
| exam-results-mobile 390×844 | 390×792 @0,44 | **0/0**/44/8 | 0.393 | 0 |
| exam-run-desktop 1440×900 | 1440×856 @0,22 | **0/0**/22/22 | 0.407 | 0 |
| exam-run-mobile 390×844 | 390×800 @0,22 | **0/0**/22/22 | 0.558 | 0 |
| exam-setup-desktop 1440×900 | 1408×445 @16,44 | 16/16/44/**411** | 0.277 | 0 |
| exam-setup-mobile 390×844 | 358×466 @16,44 | 16/16/44/**334** | 0.309 | 0 |
| onboarding-demo-mobile | 358×509 @16,21 | 16/16/21/**314** | 0.370 | 0 |
| onboarding-goal-mobile | 358×365 @16,27 | 16/16/27/**452** | 0.310 | 0 |
| onboarding-result-mobile | 359×295 @15,28 | 15/16/28/**521** | **0.154** | 0 |
| paywall-desktop 1440×900 | 1440×830 @0,41 | **0/0**/41/29 | 0.423 | 0 |
| paywall-mobile 390×844 | 390×774 @0,41 | **0/0**/41/29 | 0.398 | 0 |
| question-desktop 1440×900 | 1440×851 @0,41 | **0/0**/41/8 | 0.502 | 0 |
| question-mobile 390×844 | 390×795 @0,41 | **0/0**/41/8 | 0.685 | 0 |
| results-desktop 1440×900 | 1408×860 @16,40 | 16/16/40/**0** | 0.318 | 0 |
| results-mobile 390×844 | 358×783 @16,40 | 16/16/40/21 | 0.320 | 0 |

Палитра стабильна и совпадает с токенами (проверено на 19/19):

| токен | значение | на снимках |
|---|---|---|
| `--theme-bg-primary` | `#F5F5F5` | 51.0–98.2 % пикселей |
| `--theme-bg-surface` | `#FFFFFF` | 6.6–36.1 % |
| `--theme-text-primary` | `#1B1F23` | 0.1–1.2 % (текст) |
| `--theme-text-secondary` | `#4A4A4A` | 0.1–0.4 % |
| `--color-accent-strong` | `#1565C0` | 0.2–11.3 % (CTA/акцент) |

**Маджента-плейсхолдер: 0 px на 19/19** — регресс spec 078 (99 572 px) закрыт.

## 2. DOM-слой: измерения 19 состояний

```
AUDIT_SCREENS=19  AUDIT_OVERFLOW=[]  AUDIT_THEMES=["light/inherit"]
AUDIT_FONT_SIZES=[10,12,13,14,16,18,20,28,40,48]
```

- **Горизонтальная прокрутка: 0 экранов** (`rootOverflowX > 1` — ни одного).
- **Тач-цели (проба spec 075, 45 видимых CTA):** высоты `{44: 10, 56: 30, 58: 5}` → **0 CTA < 44 px**.
- **Тач-цели (DOM, все интерактивные):** 6 нарушений на 2 экранах —
  `paywall` × `plan-monthly|plan-yearly|plan-lifetime`, `13×13 px` (radio).
  **Ложное срабатывание:** элемент вложен в `<label>` с `padding: SPACING.sm`
  (`Paywall.tsx:232-256`), clickable-область строки = полная ширина плана.
  Критерий LAYOUT-002 (проба) проверяет именно кликабельную область и проходит.
- **Межстрочный < 1.4 при fontSize ≥ 16:** 2 узла — эмодзи `🔥` на `dashboard`
  (16px/16px, `ratio 1.0`). Символ-иконка, не текст.
- **Текст < 16px:** 416 узлов из 19 экранов — это **норма дизайн-системы**:
  `--text-xs: 12px` и `--text-sm: 14px` объявлены токенами (spec 065) и
  используются как подписи/хинты. Критерий `TYPO-001` («основной текст ≥ 16px»)
  ловит **хардкод** `13px`/`12px`, а не токены — см. §3.
- **Пробa вёрстки spec 075: 55/55 комбинаций, 0 нарушений, `knownIssues: []`.**

## 3. Источники: числовые дефекты (то, что чинится)

| # | id | файл:строка | факт | порог | severity |
|---|---|---|---|---|---|
| F-1 | TYPO-001 | `src/presentation/screens/Dashboard.tsx:259` | `fontSize: '13px'` | ≥ 16 px (хардкод запрещён) | medium |
| F-2 | TYPO-001 | `src/presentation/screens/Dashboard.tsx:381` | `fontSize: '12px'` | ≥ 16 px | medium |
| F-3 | TYPO-002 | `src/presentation/components/StreakBadge.tsx:79` | `lineHeight: 1.1` | ≥ 1.4 | medium |
| F-4 | SPACE-001 | `src/presentation/screens/Dashboard.tsx:117` | `padding: '2px 6px'` | кратно 4 | low |
| F-5 | SPACE-001 | `src/presentation/screens/Dashboard.tsx:696` | `gap: '2px'` | кратно 4 | low |
| F-6 | SPACE-002 | `Dashboard.tsx:257` | `paddingBottom: '12px'` | кратно 8 | low |
| F-7 | SPACE-002 | `Dashboard.tsx:342` | `margin: '4px 0 0 0'` | кратно 8 | low |
| F-8 | SPACE-002 | `Dashboard.tsx:652` | `gap: '4px 6px'` | кратно 8 | low |
| F-9 | SPACE-002 | `Dashboard.tsx:696` | `gap: '2px'` | кратно 8 | low |

Плюс по шкале шрифтов: значения `13` и `22` **отсутствуют** в токенах
(`--text-*`: 12/14/16/19/24/32) — оба входят в запрещённую тройку
«no-13/17/22px». `17 px` не встречается ни в одном узле (проверено
`AUDIT_FONT_SIZES`).

## 4. Что программно проверить НЕЛЬЗЯ (и почему это зафиксировано, а не скрыто)

`vision`-критерии (9 из 61) остаются `manual` — их нельзя закрыть ни grep, ни
DOM-обмером, потому что предмет — смысл, а не значение:

`USABILITY-choices`, `USABILITY-emptystates`, `USABILITY-onecta`,
`COPY-008`, `MARKETING-001..006` — требуют прочтения снимка/текста глазами.

Из них частично закрыты косвенно (тривиальные строки видны через grep):
- `MARKETING-003` (CTA называет результат) → `COPY-004` pass: в UI есть
  «Повторить сегодня», «Начать», «Продолжить», «Попробовать».
- `USABILITY-emptystates` → `STATE-004` (CTA у empty state) + отсутствие
  пустых экранов: минимальная плотность `onboarding-result` 0.154 — это
  короткий финальный экран, а не «пустота без объяснения».

## 5. Сводка

| severity | наблюдений | из них числовых (чинится) |
|---|---|---|
| critical | 0 | 0 |
| high | 0 | 0 |
| medium | 3 | 3 (F-1, F-2, F-3) |
| low | 6 | 6 (F-4 … F-9) |
| **итого** | **9** | **9** |

**Контраст (axe, WCAG 2.1 AA):** 0 узлов `color-contrast` на 19 экранах —
`COLOR-001`/`COLOR-002`/`COLOR-003` проходят (spec 079 + 079b).

**Ложные наблюдения помечены явно:** 6 «тач-целей» 13×13 (вложенный radio) и
2 «межстрочных» у эмодзи — оба разобраны в §2 и не считаются дефектами.

**Вердикт:** визуальный слой в измеряемой части чист (нет overflow, нет
обрезки, нет уезжающих CTA, нет мадженты, контраст AA выполнен, палитра
токенизирована). Числовые дефекты — 9, все в `Dashboard.tsx` (8) и
`StreakBadge.tsx` (1), все категории TYPO/SPACE.

> Отчёт **ничего не менял**: ни PNG, ни `src/**`, ни `e2e/**` (кроме временного
> `e2e/zz-audit-measure.tmp.spec.ts`, удалённого сразу после обмера).
