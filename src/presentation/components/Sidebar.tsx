import type { CSSProperties } from 'react';
import { BarChart3, ClipboardList, LayoutDashboard, ListTree, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Tux } from '@/ui/Tux';

/**
 * Десктопный сайдбар (задание «десктопный layout», блок A).
 *
 * Живёт ТОЛЬКО на десктопе: ниже `lg` (1024px) компонент не рендерится вовсе —
 * это первый класс в `className` (`hidden`), поэтому мобильная и планшетная
 * вёрстка не меняются (A5). Из этого же следует, что сайдбар не занимает место
 * в потоке на мобильном, а не «прячется» визуально.
 *
 * Геометрия — из токенов (`--space-*`, `--touch-min`), цвета — только ролями:
 * по A3 активный пункт берёт `--color-accent-strong` и уровень яркости
 * `--surface-1`, остальные — `--text-secondary`. Hex в `.tsx` запрещён Contract,
 * поэтому значения приходят из `tokens.css`.
 *
 * Фон у сайдбара намеренно НЕ задан (A4 перечисляет классы точно): его
 * поверхностью остаётся `--bg-primary` экрана, а отбивку даёт `border-r`.
 */

/** Пункты навигации (A2) как транспортный тип: по нему же маршрутизирует Dashboard. */
export type SidebarNavId = 'dashboard' | 'topics' | 'exam' | 'analytics' | 'settings';

interface NavItem {
  id: SidebarNavId;
  label: string;
  Icon: LucideIcon;
  /**
   * Есть ли у пункта назначение в продукте. `false` — экрана ещё нет
   * (`Screen` в `quizStore` не содержит `settings`), поэтому пункт рендерится
   * (состав навигации задан A2), но остаётся неинтерактивным: навигация не
   * должна обещать экран, которого нет.
   */
  hasDestination: boolean;
  /** Пометить пункт как «скоро» (для скринридера): экран в продукте появится позже. */
  soon?: boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard, hasDestination: true },
  { id: 'topics', label: 'Темы', Icon: ListTree, hasDestination: true },
  { id: 'exam', label: 'Exam', Icon: ClipboardList, hasDestination: true },
  { id: 'analytics', label: 'Аналитика', Icon: BarChart3, hasDestination: true },
  { id: 'settings', label: 'Настройки', Icon: Settings, hasDestination: false, soon: true },
];

const LOGO: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  /* 24px — по левому краю иконок пунктов (12px у списка + 12px у кнопки), чтобы
     знак и иконки навигации стояли на одной вертикали. */
  padding: '0 var(--space-5)',
};

const LOGO_TEXT: CSSProperties = {
  fontSize: 'var(--text-base)',
  fontWeight: 700,
  letterSpacing: 'var(--letter-tight)',
  color: 'var(--text-primary)',
};

const NAV: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
  padding: '0 var(--space-3)',
  listStyle: 'none',
  margin: 0,
};

const NAV_BUTTON: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  width: '100%',
  /* Тап-зона из токена, не литералом: пункт навигации — цель нажатия. */
  minHeight: 'var(--touch-min)',
  padding: 'var(--space-2) var(--space-3)',
  /* Цвет и фон (в т.ч. фон активного пункта) заданы классами A3: inline-стиль
     перебил бы класс, а фон активного пункта — часть контракта задания.
     Состояния `disabled`/`enabled` — тоже классы, а не inline `cursor`. */
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'inherit',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  textAlign: 'left',
};

/** Общие классы пункта навигации: неактивный стиль (цвет из A3) + состояния. */
const ITEM_BASE =
  'text-[color:var(--text-secondary)] disabled:opacity-45 disabled:cursor-not-allowed enabled:cursor-pointer';
/**
 * Активный пункт. Роль `--text-accent`, а не примитив `--color-accent-strong`:
 * примитив как текст на `--surface-1` в тёмной теме давал 3.23:1 (аудит
 * `desktop-audit/report.json`), роль в светлой теме равна ему (5.75:1), в тёмной —
 * светлому оттенку того же акцента (6.11:1). Заливки не затронуты.
 */
const ITEM_ACTIVE =
  'text-[color:var(--text-accent)] bg-[color:var(--surface-1)] disabled:opacity-45 disabled:cursor-not-allowed enabled:cursor-pointer';

export interface SidebarProps {
  /** Активный пункт. Сайдбар рендерит Dashboard, поэтому по умолчанию — он. */
  active?: SidebarNavId;
  /**
   * Обработчик пункта. Не передан → пункт неинтерактивен: обработчик и сайдбар
   * не должны расходиться (интерактивный пункт без действия — мёртвый контрол).
   */
  onNavigate?: (id: SidebarNavId) => void;
  /**
   * Пункты, временно недоступные В ЭТОМ состоянии экрана (не «экрана нет», а
   * «сейчас некуда вести»): например, в Fresh User Mode список тем скрыт, а
   * Exam/Аналитика намеренно не предлагаются первым шагом. Такие пункты остаются
   * видимыми, но не получают обработчик — навигация повторяет состояние экрана,
   * а не обходит его гейты.
   */
  disabled?: readonly SidebarNavId[];
}

export function Sidebar({ active = 'dashboard', onNavigate, disabled = [] }: SidebarProps) {
  return (
    <aside
      data-testid="sidebar"
      aria-label="Боковая панель"
      className="hidden lg:flex lg:flex-col w-60 shrink-0 border-r border-[color:var(--border-subtle)]"
    >
      {/* Навигация залипает в скролл-контейнере (`#root`), а сам `aside` тянется
          на всю высоту колонки: `border-r` поэтому идёт во всю высоту, а пункты не
          уезжают из вьюпорта на длинной странице. Offset залипания равен верхнему
          паддингу `ScreenContainer` (`--space-4` + safe-area), иначе при скролле
          рейл уезжал на 16px выше колонки контента и упирался в самую кромку. */}
      <div
        className="lg:sticky"
        style={{
          top: 'calc(var(--space-4) + var(--safe-top))',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-5)',
          paddingTop: 'var(--space-5)',
          paddingBottom: 'var(--space-5)',
        }}
      >
        <div style={LOGO}>
          <Tux size={24} />
          {/* Не `h1`: заголовок экрана — единственный h1 Dashboard («LinuxExam»),
              второй h1 сломал бы роль заголовка (e2e ищет level: 1 по имени). */}
          <span style={LOGO_TEXT}>LinuxExam</span>
        </div>

        <nav aria-label="Основная навигация">
          {/* `role="list"`: Safari/VoiceOver убирает семантику списка при
              `list-style: none` — роль возвращает «список из 5». */}
          <ul role="list" style={NAV}>
            {NAV_ITEMS.map(({ id, label, Icon, hasDestination, soon }) => {
              const isActive = id === active;
              const clickable =
                hasDestination && onNavigate !== undefined && !disabled.includes(id);

              return (
                <li key={id}>
                  <button
                    type="button"
                    data-testid={`sidebar-${id}`}
                    /* Активный пункт — «текущая страница» для скринридера; пункт без
                       назначения остаётся в списке, но недоступен для нажатия. */
                    aria-current={isActive ? 'page' : undefined}
                    disabled={!clickable}
                    /* Причина недоступности — и для мыши (`title`), и для
                       скринридера (`aria-label`): визуально состояние несёт
                       `disabled:opacity-45`. Отдельный `sr-only`-узел не заводим —
                       такой span (clientWidth 1px при тексте на 57px) читается
                       проверкой горизонтальных переполнений `mobile-layout` как
                       выезд за экран. */
                    aria-label={soon ? `${label} — скоро` : undefined}
                    title={hasDestination ? undefined : 'Экран настроек появится позже'}
                    onClick={clickable ? () => onNavigate(id) : undefined}
                    className={isActive ? ITEM_ACTIVE : ITEM_BASE}
                    /* Активное состояние не должно читаться ТОЛЬКО цветом
                       (WCAG 1.4.1): фон-плашка даёт всего 1.11:1 к фону рейла, а
                       сам цвет текста — 6.11:1. Поэтому у активного пункта ещё и
                       некрасочный признак — полоса 2px слева ролью акцента — плюс
                       вес 700 (иерархия весом, а не цветом, DESIGN.md).
                       Инлайн-стиль: `NAV_BUTTON.fontWeight = 600` перебил бы класс. */
                    style={
                      isActive
                        ? {
                            ...NAV_BUTTON,
                            fontWeight: 700,
                            boxShadow: 'inset 2px 0 0 var(--text-accent)',
                          }
                        : NAV_BUTTON
                    }
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
