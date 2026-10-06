import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Flame, MoonStar, Sun } from 'lucide-react';
import { useQuizStore } from '@/store/quizStore';
import { SPACING, LAYOUT } from '@/presentation/theme';
import { useTelegramMainButton, useMainButtonAvailable } from '@/hooks/useTelegramMainButton';
import { ScreenContainer } from '@/presentation/components/ScreenContainer';
import { FIXED_FOOTER_Z_INDEX } from '@/presentation/components/fixedFooter';
import { StreakBadge } from '@/presentation/components/StreakBadge';
import { XpBar } from '@/presentation/components/XpBar';
import { DailyGoalPicker } from '@/presentation/components/DailyGoalPicker';
import { useCanAccessTopic } from '@/store/paywall';
import { isFreeTopic } from '@/domain/paywall';
import { TOPICS, AVAILABLE_TOPICS } from '@/data/topics';
import { getBankTotal, getTopicCount } from '@/data/questions';
import { Badge, Button, Card } from '@/ui';
import type { BadgeVariant } from '@/ui';
import type { ResolvedTheme } from '@/utils/theme';

interface Props {
  /** Theme currently in effect, owned by useThemeController in App. */
  theme: ResolvedTheme;
  /** Flips the theme, or returns to inherit when it matches the system one. */
  onToggleTheme: () => void;
}

/** Есть ли у пользователя доступ к теме целиком (spec 063). */
type TopicGate = (key: string) => boolean;

/**
 * Клик по теме (spec 063). Доступ есть — открывается существующий прогон
 * (`startTopicQuiz`); доступа нет (платная тема, `!isPro`, trial неактивен) —
 * поднимается контентный paywall. Логика Free-тем не меняется: они всегда
 * проходят по первой ветке.
 */
function openTopic(key: string, hasAccess: boolean) {
  const store = useQuizStore.getState();
  if (!hasAccess) {
    store.showPaywall();
    return;
  }
  store.startTopicQuiz(key);
}

/**
 * Основной CTA дашборда («Начать обучение» / «Повторить сегодня» /
 * «Продолжить изучение»). Вынесен в константу: три состояния должны выглядеть
 * одинаково, иначе одно и то же действие снова разъедется по стилям (spec 065).
 *
 * spec-фабрика (pilot): роль кнопки теперь в `src/ui/Button` (variant="primary"),
 * поэтому здесь остались только геометрия и раскладка содержимого. Цвета ушли в
 * контракт компонента: `--accent` + `--btn-primary-text` (spec 079).
 */
const PRIMARY_CTA: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

/** Правая подпись CTA: счётчик вопросов/тем. */
const CTA_COUNTER: React.CSSProperties = { fontSize: 'var(--text-xs)', fontWeight: 600 };

/** Вторичный CTA: обводка акцентом, одинаковый для «Exam mode» и «Аналитика». */
const SECONDARY_CTA: React.CSSProperties = { marginTop: 'var(--space-4)' };

/**
 * «Повторить ошибки»: красная подложка и рамка. Подложка — 10% от роли
 * `--danger` через color-mix (литерал `rgba(244,67,54,0.1)` дублировал RGB
 * токена и разъехался бы при его смене); мета-подпись берёт тёмную роль
 * `--color-danger-strong` (spec 079).
 */
const REVIEW_WRONG_BUTTON: React.CSSProperties = {
  background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
  border: '1px solid var(--danger)',
  color: 'var(--text-primary)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

/**
 * Ключ ПЕРВОЙ доступной бесплатной темы (spec 065, К5.2).
 *
 * Считается из реестра, а не хардкодится: порядок тем — часть реестра, и при
 * перестановке/добавлении темы подсказка обязана переехать сама. Порядок
 * `isFreeTopic` (domain) — единственный источник правды о том, что бесплатно.
 */
const FIRST_FREE_TOPIC = TOPICS.find(
  (topic) => topic.status === 'available' && isFreeTopic(topic.key),
)?.key;

/**
 * «Скоро» — четвёртый случай того же каркаса (spec 067/079). Сам каркас,
 * minHeight 32px, обрезка и цвет тёмной роли акцента теперь в
 * `src/ui/Badge` (variant="locked"); здесь остались только различия
 * надписи: верхний регистр и разрядка.
 */
const LOCKED_BADGE: React.CSSProperties = {
  textTransform: 'uppercase',
  letterSpacing: 'var(--letter-wide, 0.5px)',
};

/**
 * Бейдж доступа в строке темы. Подпись и `variant` выводятся из ОДНОГО
 * предиката: до фикса подпись считалась по `isFree || allowed` («Бесплатно» и
 * для платной темы с доступом), а variant — по `isFree` (`pro`, синий), поэтому
 * одно и то же слово рисовалось двумя цветами (diag-dashboard-fix, симптом 1).
 *
 * Роли: бесплатная тема — БЕЗ бейджа; платная тема С доступом — тоже БЕЗ бейджа
 * (решение C, dashboard-ux-2: замок 🔒 убран из строки, доступ по клику);
 * платная БЕЗ доступа — плашка «PRO» (`pro`, `paywall-badge-pro`: отдельный
 * контракт spec 063, по тексту «PRO» платную строку находят `e2e/screens.ts` и
 * `ux-screenshots.tmp`); тема со статусом `planned` — «Скоро» (`locked`).
 *
 * Строка платной темы с доступом визуально идентична free-строке — это и есть
 * требование решения C.
 */
interface TopicBadge {
  testid?: string;
  label: string;
  variant: BadgeVariant;
}

export default function Dashboard({ theme, onToggleTheme }: Props) {
  // Counts come from the bank manifest (≈260 B) rather than from the loaded bank:
  // the Dashboard must show real numbers before the topic chunks arrive.
  const navigateTo = useQuizStore((s) => s.navigateTo);
  const streak = useQuizStore((s) => s.streak);
  const totalXp = useQuizStore((s) => s.totalXp);
  const isQuizInProgress = useQuizStore((s) => s.isQuizInProgress);
  const currentIndex = useQuizStore((s) => s.currentIndex);
  const reviewQuestionIds = useQuizStore((s) => s.reviewQuestionIds);
  const resumeQuiz = useQuizStore((s) => s.resumeQuiz);
  const startRegularQuiz = useQuizStore((s) => s.startRegularQuiz);
  const wrongQuestionIds = useQuizStore((s) => s.wrongQuestionIds);
  const startReviewQuiz = useQuizStore((s) => s.startReviewQuiz);

  // Paywall (spec 063). Один хук на компонент: он подписан на `isPro` и
  // `trialStartedAt`, а сам ответ про конкретную тему считает чистая функция
  // домена (`canAccessTopic`), поэтому 14 тем не подписывают компонент 14 раз.
  const paywallAccess: TopicGate = useCanAccessTopic;

  // FSRS-lite (spec 052): нагрузка для кнопки «Повторить сегодня (N)».
  // Банк отдаёт store асинхронно (per-topic chunks), поэтому N пересчитывается
  // на каждый его приход — до загрузки банка review-today просто не показывается.
  const bankIds = useQuizStore(useShallow((s) => s.questions.map((question) => question.id)));
  const questions = useQuizStore((s) => s.questions);
  const scheduledReviews = useQuizStore((s) => s.scheduledReviews);
  const questionStats = useQuizStore((s) => s.questionStats);
  const ensureReviewsInitialized = useQuizStore((s) => s.ensureReviewsInitialized);
  const getSessionCounts = useQuizStore((s) => s.getSessionCounts);
  const getSessionIds = useQuizStore((s) => s.getSessionIds);

  // Одна сессия — до SESSION_LIMIT вопросов, просроченные первыми (spec 065).
  // Пересчитывается на каждый приход банка (per-topic chunks) и на каждое
  // изменение реестра расписания: ответ в прогоне сдвигает `next` в будущее.
  const sessionIds = useMemo(
    () => getSessionIds(),
    [getSessionIds, scheduledReviews, bankIds],
  );
  const counts = useMemo(
    () => getSessionCounts(),
    [getSessionCounts, scheduledReviews, bankIds],
  );

  // Просроченные из отобранной сессии: порядок внутри сессии уже «сначала самые
  // запущенные», поэтому фильтр сохраняет порядок. Остаток за пределами сессии
  // считает экран Results — здесь важно только то, что будет пройдено сейчас.
  const dueIdSet = useMemo(
    () => new Set(questions.filter((q) => scheduledReviews[q.id] !== undefined).map((q) => q.id)),
    [questions, scheduledReviews],
  );
  const sessionDueIds = sessionIds.filter((id) => dueIdSet.has(id));
  const sessionNewIds = sessionIds.filter((id) => !dueIdSet.has(id));
  // Числа берутся из отобранной сессии, а не из общего пула: при пуле больше
  // SESSION_LIMIT кнопка обещает ровно то, что откроет.
  const dueCount = sessionDueIds.length;
  const newCount = sessionNewIds.length;
  const hasPending = counts.dueCount > dueCount || counts.newCount > newCount;

  // Профиль без единого ответа: показываем приглашение, а не «повторить».
  // Условие — пустая статистика, а не пустой реестр расписания: реестр
  // до-наполняется при монтировании (ensureReviewsInitialized НИЖЕ) и на свежем
  // профиле выглядит так же полным, как у активного пользователя.
  const hasNoHistory = Object.keys(questionStats).length === 0;

  // «Начать обучение» ведёт не в прогон, а к списку тем: на свежем профиле
  // пользователю сначала нужен выбор темы, а не первый вопрос подряд.
  const topicsRef = useRef<HTMLDivElement | null>(null);
  const scrollToTopics = () => {
    topicsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Реестр расписания до-наполняется «пора сейчас» ровно один раз на банк:
  // экшен идемпотентен и возвращает тот же объект, когда заполнять нечего.
  useEffect(() => {
    ensureReviewsInitialized(bankIds);
  }, [ensureReviewsInitialized, bankIds]);

  // CRITICAL: useShallow with PRIMITIVES ONLY.
  // getProgress() returns a new object each call. useShallow on the full
  // object still re-renders because the object reference changes.
  // Solution: return only primitives from the selector.
  const { answered } = useQuizStore(
    useShallow((s) => {
      const p = s.getProgress();
      return { answered: p.answered };
    })
  );

  // spec 072: CTA не должен исчезать, если нативный MainButton недоступен —
  // тогда роль кнопки берёт in-app фолбэк (тот же контракт, что в Question.tsx).
  // spec 076 F3: футер CTA — sticky (в потоке), поэтому высота не измеряется и
  // `useFixedFooterPadding`/`--fixed-footer-h` здесь не нужны.
  const mainButtonReady = useMainButtonAvailable();

  // XP-дубли (diag-dashboard-fix, решение капитана STOP-1 v1): узел
  // `retention-goal-line` («Цель: X / Y XP») удалён — дневную цель уже
  // показывает подпись XpBar, третья копия тех же чисел была дублем.
  // Вместе с узлом ушёл и селектор `useDailyGoalProgress`: он был нужен только
  // ему, а незанятый импорт держал бы ложную зависимость от dailyGoal.
  useTelegramMainButton('Продолжить', () => navigateTo('question'));

  // Reset scroll when the dashboard mounts.
  useEffect(() => {
    const el =
      document.getElementById('root') ?? document.scrollingElement ?? document.documentElement;
    el.scrollTop = 0;
  }, []);


  const totalQuestions = getBankTotal();
  const progressPercent = totalQuestions > 0 ? (answered / totalQuestions) * 100 : 0;
  const level = Math.floor(totalXp / 100) + 1;
  const xpPercent = totalXp % 100;

  return (
    <ScreenContainer>
      {/* Status strip */}
      <div
        id="status-strip"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 'var(--space-2)',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
        }}
      >
        {/* Серия (streak) НЕ дублируется здесь: она живёт в StreakBadge ниже,
            где есть число, состояние и мотивирующее сообщение. В status-strip
            остаются только уровень и полоса прогресса (UX-фикс). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Уровень {level}</span>
          {/* diag-dashboard-fix (симптом 5): полоса показывает XP ВНУТРИ уровня
              (`totalXp % 100`), а не дневную цель, и в отчёте это читалось как
              «Уровень 1 · 10 %» рядом с дневной целью 10/20. Метрика оставлена:
              дневную цель уже показывает XpBar, а вторая дневная полоса была бы
              тем же дублем XP, против которого симптом 6. Неоднозначность снята
              именем — «Уровень N (XP внутри)», а не «Прогресс уровня». */}
          <span
            role="progressbar"
            aria-valuenow={xpPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Уровень ${level} (XP внутри)`}
            style={{
              display: 'inline-block',
              width: '40px',
              height: '4px',
              background: 'var(--bg-surface)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                display: 'block',
                width: `${xpPercent}%`,
                height: '100%',
                background: 'var(--accent)',
                transition: 'width 0.3s ease',
              }}
            />
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Button
            variant="ghost"
            testId="theme-toggle"
            onClick={onToggleTheme}
            ariaLabel={
              theme === 'light' ? 'Переключить на тёмную' : 'Переключить на светлую'
            }
            style={{ cursor: 'pointer' }}
          >
            {theme === 'light' ? (
              <Sun size={20} color="var(--text-secondary)" aria-hidden="true" />
            ) : (
              <MoonStar size={20} color="var(--text-secondary)" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      {/* Title block */}
      <div style={{ marginTop: 'var(--space-5)' }}>
        <h1
          style={{
            fontSize: 'var(--heading-1)',
            fontWeight: 700,
            letterSpacing: '-0.5px',
            margin: 0,
            color: 'var(--text-primary)',
          }}
        >
          LinuxExam
        </h1>
        <p
          data-testid="dashboard-subtitle"
          style={{
            fontSize: 'var(--body)',
            color: 'var(--text-secondary)',
            margin: 'var(--space-2) 0 0 0',
          }}
        >
          Подготовка к RHCSA за 15 минут в день
        </p>
      </div>

      {/* Retention-зона (spec 061): streak badge + XP bar с дневной целью рядом.
          Существующие блоки ниже не тронуты — зона только добавлена. */}
      <div
        id="dashboard-retention"
        data-testid="dashboard-retention"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          marginTop: 'var(--space-5)',
        }}
      >
        <StreakBadge />
        <XpBar />
      </div>
      {/* diag-dashboard-fix (STOP-1 v1): узел `retention-goal-line`
          («Цель: X / Y XP») удалён по решению капитана — дневную цель уже
          показывает подпись XpBar («X / Y XP»), третий узел с теми же числами
          был дублем XP (симптом 6). */}

      {/* Progress */}
      <div id="dashboard-progress" data-testid="dashboard-progress" style={{ marginTop: 'var(--space-5)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 'var(--text-sm)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: 'var(--text-secondary)',
          }}
        >
          <span>Прогресс</span>
          <span>
            {answered} из {totalQuestions}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Прогресс теста"
          style={{
            marginTop: 'var(--space-2)',
            height: '4px',
            background: 'var(--bg-surface)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              background: 'var(--accent)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Вход в занятие (spec 065; взаимоисключение ветвей — spec 066).
          У профиля без единого ответа (`hasNoHistory`) повторять нечего, поэтому
          показывается РОВНО приглашение к обучению — без «Повторить сегодня (30)»
          и без строки остатка. До spec 066 эти блоки жили отдельными условиями и
          рендерились рядом с приглашением. Запас всё равно существует:
          `ensureReviewsInitialized` при монтировании проставляет всему банку
          `next = now`, `pickToday` считает весь банк просроченным, а
          `getSessionIds()` обрезает его до SESSION_LIMIT = 30. Для профиля
          С историей поведение прежнее: просроченные — повторение; остались только
          новые — продолжение. Прогон идёт review-стримом, поэтому бесплатный
          лимит не расходуется. */}
      {hasNoHistory ? (
        <Button
          variant="primary"
          testId="start-learning"
          onClick={scrollToTopics}
          style={PRIMARY_CTA}
        >
          <span>Начать обучение</span>
          <span style={CTA_COUNTER}>{`${TOPICS.length} тем`}</span>
        </Button>
      ) : (
        <>
          {dueCount > 0 ? (
            <Button
              variant="primary"
              testId="review-today"
              onClick={() => startReviewQuiz(sessionDueIds, 'today')}
              style={PRIMARY_CTA}
            >
              {/* Решение B (dashboard-ux-2): счётчик живёт только справа
                  («N вопр.»), в подписи кнопки числа больше нет — оно
                  дублировалось дважды в одной строке. */}
              <span>Повторить сегодня</span>
              <span style={CTA_COUNTER}>{`${dueCount} вопр.`}</span>
            </Button>
          ) : null}

          {newCount > 0 && dueCount === 0 ? (
            <Button
              variant="primary"
              testId="continue-learning"
              onClick={() => startReviewQuiz(sessionNewIds, 'today')}
              style={PRIMARY_CTA}
            >
              <span>{`Продолжить изучение (${newCount})`}</span>
              <span style={CTA_COUNTER}>{`${newCount} вопр.`}</span>
            </Button>
          ) : null}

          {/* Остаток за пределами одной сессии: N в подписи — размер следующей. */}
          {hasPending && dueCount > 0 ? (
            <p
              data-testid="review-today-remainder"
              style={{
                margin: `${SPACING.sm} 0 0 0`,
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
              }}
            >
              {`Осталось повторить: ${counts.dueCount - dueCount}`}
            </p>
          ) : null}
        </>
      )}

      {/* Exam mode (spec 054) — единственный экзамен в приложении (spec 068):
          отдельный поток из трёх экранов (настройка → прогон → итоги) с пресетами
          30/60/90 и разбором по темам. Историческая кнопка «Режим экзамена
          (20 вопросов, 30 минут)» удалена вместе с инлайн-режимом. */}
      <Button
        variant="secondary"
        testId="exam-mode"
        onClick={() => navigateTo('exam-setup')}
        style={SECONDARY_CTA}
      >
        📝 Exam mode — 30/60/90 вопросов с разбором
      </Button>

      {/* Analytics (spec 058): «персональный тренер» — radar по 14 темам,
          готовность, слабые зоны и тренд за 7 дней. Данные уже в persist
          (questionStats), поэтому экран ничего не дозагружает. */}
      <Button
        variant="secondary"
        testId="analytics-mode"
        onClick={() => navigateTo('analytics')}
        style={SECONDARY_CTA}
      >
        📊 Аналитика — готовность, слабые темы, тренд
      </Button>

      {/* «Повторить ошибки» — resumed from the regular stream's wrong answers */}
      {wrongQuestionIds.length > 0 && (
        <Button
          variant="primary"
          testId="review-wrong"
          onClick={() => startReviewQuiz(wrongQuestionIds)}
          style={REVIEW_WRONG_BUTTON}
        >
          <span>Повторить ошибки</span>
          <span
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-danger-strong)',
              fontWeight: 600,
            }}
          >
            {wrongQuestionIds.length} вопр.
          </span>
        </Button>
      )}

      {/* RHCSA Roadmap - informational only, topics are NOT interactive */}
      <div
        id="dashboard-topics"
        data-testid="dashboard-topics"
        ref={topicsRef}
        style={{ marginTop: 'var(--space-6)' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 'var(--space-3)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-xs)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--letter-wide, 0.5px)',
              color: 'var(--text-secondary)',
              fontWeight: 600,
            }}
          >
            Программа RHCSA
          </span>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-secondary)',
            }}
          >
            {`${AVAILABLE_TOPICS.length} из ${TOPICS.length} тем`}
          </span>
        </div>

        {TOPICS.map((topic) => {
          const count = getTopicCount(topic.key);
          const isAvailable = topic.status === 'available';
          const Icon = topic.Icon;
          // spec 063: Free-темы открыты всем, Paid-темы — только Pro или активным
          // trial-ом. Тема со статусом «Скоро» остаётся неинтерактивной: доступ
          // для неё не считается, бейджа нет.
          const isFree = isFreeTopic(topic.key);
          const allowed = !isAvailable || paywallAccess(topic.key);
          // Решение C (dashboard-ux-2): замок 🔒 у платной темы убран — доступ
          // определяется кликом (free / Pro / активный trial). Бейдж остаётся
          // только у платной темы БЕЗ доступа: «PRO» — это её paywall-метка.
          const badge: TopicBadge | null =
            !isAvailable || isFree || allowed
              ? null
              : { testid: 'paywall-badge-pro', label: 'PRO', variant: 'pro' };

          const rowStyle = {
            display: 'flex' as const,
            alignItems: 'center' as const,
            gap: 'var(--space-3)',
            padding: 'var(--space-3)',
            marginBottom: 'var(--space-2)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            opacity: isAvailable ? 1 : 0.55,
            width: '100%' as const,
            textAlign: 'left' as const,
            fontFamily: 'inherit',
            color: 'inherit',
          };

          const inner = (
            <>
              <Icon
                size={20}
                color={isAvailable ? 'var(--accent)' : 'var(--text-secondary)'}
                aria-hidden="true"
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Название и подсказка (spec 067): подсказка идёт СРАЗУ за
                    названием в отдельной колонке, а не в общем ряду с чипом
                    вопросов. `flexWrap: wrap` роняет её на свою строку, когда
                    места не хватает (390px + длинное название темы), вместо
                    того чтобы распирать карточку по горизонтали. */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-1) var(--space-2)',
                    flexWrap: 'wrap',
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {topic.title}
                  </div>
                  {topic.key === FIRST_FREE_TOPIC && (
                    <Badge variant="hint" testId="topic-first-cta">
                      начните с этой
                    </Badge>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-secondary)',
                    marginTop: 'var(--space-1)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {topic.description}
                </div>
              </div>
              {/* Правая колонка: чип доступа и счётчик. `flexWrap` — чтобы на узком
                  экране они переносились вниз, а не выдавливали название. */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 'var(--space-1)',
                  flexShrink: 0,
                  maxWidth: '45%',
                }}
              >
                {/* `LOCKED_BADGE` (капс + разрядка) — только для плашки «PRO»:
                    после решения C это единственный бейдж в строке темы. */}
                {badge !== null && (
                  <Badge variant={badge.variant} testId={badge.testid} style={LOCKED_BADGE}>
                    {badge.label}
                  </Badge>
                )}
                {isAvailable ? (
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      // spec 079: 12px на белом — 3.12:1 при пороге 4.5:1 →
                      // тёмный оттенок акцента (5.75:1).
                      color: 'var(--color-accent-strong)',
                      flexShrink: 0,
                    }}
                  >
                    {count} вопр.
                  </span>
                ) : (
                  <Badge variant="locked" style={LOCKED_BADGE}>
                    Скоро
                  </Badge>
                )}
              </div>
            </>
          );

          if (isAvailable) {
            return (
              <Card
                key={topic.key}
                variant="plain"
                as="button"
                testId={`topic-${topic.key}`}
                onClick={() => openTopic(topic.key, allowed)}
                ariaLabel={`Начать тему: ${topic.title}`}
                style={rowStyle}
              >
                {inner}
              </Card>
            );
          }

          return (
            <Card key={topic.key} variant="plain" style={rowStyle}>
              {inner}
            </Card>
          );
        })}
      </div>
      {/* Resume banner - unfinished regular quiz only */}
      {isQuizInProgress && !reviewQuestionIds ? (
        <Card
          variant="plain"
          testId="resume-banner"
          style={{
            border: 'none',
            marginTop: 'var(--space-4)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>Тест не завершён</div>
            <div
              data-testid="resume-position"
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                marginTop: 'var(--space-0-5)',
              }}
            >
              {`Вопрос ${currentIndex + 1} из ${totalQuestions}`}
            </div>
          </div>
          {/* diag-dashboard-fix (симптом 3): баннер и нижний футер показывали ДВЕ
              primary-CTA с одинаковой подписью «Продолжить», когда прогон не
              закончен и нативный MainButton недоступен. Кнопка баннера переведена
              в secondary: обработчик (`resumeQuiz`) и подпись прежние — их пинят
              e2e-контракты (paywall.spec.ts:84 кликает именно её, а фикстура
              `resumeSeededRun` используется 7 спеками), а primary на экране
              остаётся одна — нижняя `dashboard-continue`.
              Вариант «баннер без CTA» отклонён по той же причине: `resume-button`
              — публичный data-testid вне разрешённого списка правок. */}
          <Button
            variant="secondary"
            testId="resume-button"
            onClick={resumeQuiz}
            style={{
              width: 'auto',
              padding: 'var(--space-2) var(--space-3)',
              marginTop: 0,
              borderRadius: 'var(--btn-secondary-radius)',
              fontSize: 'var(--text-xs)',
            }}
          >
            Продолжить
          </Button>
        </Card>
      ) : null}

      {/* Вход в регулярный поток вне Telegram и когда нативный MainButton
          недоступен (spec 072). НЕ переименовывается в start-learning и НЕ
          удаляется: это отдельный контракт (browser-mode.spec проверяет его текст
          «Продолжить»), а start-learning — приглашение для профиля без единого
          ответа (выше).

          spec 076 F3: CTA переведён в **sticky**-футер (`position: sticky`,
          `bottom: 0`). Кнопка стоит после всего контента дашборда, поэтому в
          потоке она оказывалась на y=1904…2027 — вне вьюпорта на всех 5 размерах
          сетки 075 (`dashboard-continue` ниже сгиба, 5 случаев). `sticky`
          считается от вьюпорта (при `#root` высотой 640–915 px и контенте ~2030 px
          элемент удерживается у нижней кромки уже на `scrollTop = 0`) и при этом
          остаётся В ПОТОКЕ. Именно поэтому здесь sticky, а не `fixed`, как в
          Question/ExamRun/Paywall: `fixed` выведен из потока и требует распорку
          `fixed-footer-spacer`, а её отсутствие в Telegram-ветке — контракт spec
          071 (`regression-071.spec.ts:353`: `spacer → 0`; в этой ветке
          `mainButtonReady === false` и in-app футер рендерится). Sticky-элемент
          в потоке и распорки не требует.
        */}
      {!mainButtonReady && (
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: FIXED_FOOTER_Z_INDEX,
            marginTop: SPACING.xl,
            paddingTop: SPACING.sm,
            paddingBottom: 'calc(var(--space-2) + env(safe-area-inset-bottom, 0px))',
            background: 'var(--bg-primary)',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <Button
            variant="primary"
            testId="dashboard-continue"
            onClick={() => {
              if (reviewQuestionIds) {
                startRegularQuiz();
              }
              navigateTo('question');
            }}
            style={{
              // spec 079: тёмный `--text-primary` на акцентной заливке — 2.88:1.
              // Роль «текст на акцентной кнопке» = белый (tokens.css, в Button).
              padding: SPACING.md,
              borderRadius: LAYOUT.buttonRadius,
              marginTop: 0,
              fontSize: 'var(--body)',
            }}
          >
            Продолжить
          </Button>
        </div>
      )}

      {/* Распорки под футер здесь НЕТ намеренно (spec 076 F3): sticky-футер
          остаётся в потоке, поэтому ничего не перекрывает и распорка не нужна —
          в отличие от `fixed` в Question/ExamRun/Paywall. Наличие
          `fixed-footer-spacer` в Telegram-ветке запрещено контрактом spec 071. */}

{/* Legal disclaimer — trademark safety (independent trainer notice) */}
      <div
        data-disclaimer="legal"
        style={{
          marginTop: 'var(--space-6)',
          paddingTop: 'var(--space-3)',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
        }}
      >
        LinuxExam — независимый тренажёр. Не аффилирован с Red Hat, Inc. и CompTIA.
        RHCSA® — торговая марка Red Hat, Inc. CompTIA® и Linux+® — торговые марки CompTIA.
        Вопросы оригинальные, основаны на публично доступных exam objectives.
      </div>

      {/* Показывается ровно один раз: после онбординга и до подтверждения цели. */}
      <DailyGoalPicker />
</ScreenContainer>
  );
}
