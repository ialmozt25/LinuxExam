# AGENTS.md — LinuxExam

## Команды
- `npm run typecheck`
- `npm run test:run`
- `npm run test:e2e`
- `npm run build`
- `npm run sync:check`
- `npm run qc`
- `npm run fitness`

## Стек
Vite 5, React 18, TypeScript 5.5 (strict), Tailwind 3 + CSS-токены, Zustand 5 (persist), Vitest, Playwright 1.63.

## Структура
- `src/domain/` — чистые функции, без React/Zustand
- `src/presentation/screens/` — экраны
- `src/presentation/components/` — компоненты экранов
- `src/ui/` — переиспользуемые Badge/Button/Card
- `src/presentation/theme/tokens.css` — единственный источник цветов

## Границы
Никогда:
- hex-цвета в `.tsx` (только `var(--token)` из `tokens.css`)
- `console.log` в `src/`
- `any` без обоснования
- правки `src/data/`, `tools/`, `.project/sync.mjs`, `backend/`
- `100vh` без fallback `100dvh`
- inline styles для `:hover`/`:focus`
- string interpolation в `className`
- `max-width` медиа-запросы (только mobile-first `min-width`)
- `will-change` превентивно

Всегда:
- общие компоненты — в `src/ui/`
- цвета и отступы — из `tokens.css`
- `aria-label` для иконочных кнопок

## Workflow
1. Прочитай contract `.project/governance/frontend-contract.yaml`.
2. Возьми skill по триггеру из `.dsh/skills/`.
3. Сделай работу и прогони `npm run fitness`.
4. Не коммить без approve капитана.

## Ссылки
- `.project/governance/frontend-contract.yaml` — правила (источник истины, конфликт → Contract)
- `.dsh/skills/` — процедуры
- Правила вёрстки: `.dsh/skills/ui-styling-rules/SKILL.md`
- `.project/ORCH-RULES.md` — правила оркестрации
