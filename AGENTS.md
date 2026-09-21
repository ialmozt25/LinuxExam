# Правила работы над проектом LinuxExam
## Стек
- Vite 5, React 18, TypeScript 5.5 (strict), Tailwind 3, Zustand 5 (persist)
- Архитектура: 4 слоя — data, domain, presentation, platform
- Domain-слой: чистые функции, ноль импортов из zustand/react
- Store: src/store/quizStore.ts, делегирует в domain-сервисы

## Правила кода
- TypeScript strict, zero `any`, zero `@ts-ignore`
- После каждого изменения: `npm run typecheck`
- Перед коммитом: `npm run build`
- Conventional commits: feat:, fix:, refactor:
- Весь UI-текст на русском языке
- Все цвета/отступы — именованные константы
- Все новые domain-функции покрывать unit-тестами (Vitest)
- При изменении сигнатур функций обновлять все места вызова

## Запрещено
- Устанавливать новые зависимости без явного запроса
- Изменять persist config без запроса
- Коммитить node_modules, dist, .env
- Использовать `as`-касты для валидации JSON (нужна runtime-проверка)
- Коммитить без предварительного `npm run typecheck`
- Оставлять `console.warn` в production-коде
