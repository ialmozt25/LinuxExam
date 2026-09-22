import { useCallback, useEffect, useState } from 'react';
import { isTMA, themeParams } from '@telegram-apps/sdk-react';
import { MoonStar, Sun } from 'lucide-react';
import { useQuizStore } from '@/store/quizStore';
import { AppHeader } from '@/presentation/components/AppHeader';
import { ScreenContainer } from '@/presentation/components/ScreenContainer';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { THEME_CHANGE_EVENT } from '@/hooks/useThemeController';
import { applyThemeState, getThemeState, type ResolvedTheme } from '@/utils/theme';

const MEDIA_QUERY = '(prefers-color-scheme: dark)';

function readOsIsDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(MEDIA_QUERY).matches;
}

/**
 * The Telegram colour-scheme signal, or undefined when it cannot be trusted.
 * Strict comparison on purpose: a Computed that is not mounted yields undefined,
 * which must NOT be read as 'dark'.
 */
function readTelegramIsDark(): boolean | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    if (isTMA() !== true) return undefined;
    const value = themeParams.isDark();
    return value === true || value === false ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Theme settings: a single switch.
 *
 * The label, the icon and `aria-checked` all describe the CURRENT resolved
 * theme; the switch flips it. Choosing a value that happens to equal the
 * inherited one clears the stored key, so the app falls back to following
 * Telegram / the system instead of pinning a redundant explicit choice.
 */
export default function Settings() {
  const navigateTo = useQuizStore((s) => s.navigateTo);
  const [osIsDark, setOsIsDark] = useState<boolean>(readOsIsDark);
  const [telegramIsDark, setTelegramIsDark] = useState<boolean | undefined>(readTelegramIsDark);
  const [state, setState] = useState(() => getThemeState());

  useTelegramBackButton(() => navigateTo('dashboard'));

  const sync = useCallback(() => {
    setState(getThemeState());
    setTelegramIsDark(readTelegramIsDark());
  }, []);

  // Keep the displayed state honest when anything else changes it.
  useEffect(() => {
    sync();
    window.addEventListener(THEME_CHANGE_EVENT, sync);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, sync);
  }, [sync]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(MEDIA_QUERY);
    const onChange = (e: MediaQueryListEvent) => setOsIsDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // The single source for both the label and the switch position.
  const followSystem = state.choice === 'system';
  const isDark: boolean = followSystem
    ? telegramIsDark !== undefined
      ? telegramIsDark
      : osIsDark
    : state.choice === 'dark';

  const handleToggle = () => {
    const newChoice: ResolvedTheme = isDark ? 'light' : 'dark';
    const systemTheme: ResolvedTheme = (telegramIsDark !== undefined ? telegramIsDark : osIsDark)
      ? 'dark'
      : 'light';

    if (newChoice === systemTheme) {
      window.localStorage.removeItem('lx-theme');
    } else {
      window.localStorage.setItem('lx-theme', newChoice);
    }
    window.localStorage.removeItem('lx-theme-manual');

    const fresh = getThemeState();
    setState(fresh);
    applyThemeState(fresh, telegramIsDark);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  const label = isDark ? 'Тёмная тема' : 'Светлая тема';
  const hint = followSystem
    ? `Следует системной теме (сейчас: ${isDark ? 'тёмная' : 'светлая'})`
    : 'Ручной выбор';
  const Icon = isDark ? MoonStar : Sun;

  return (
    <ScreenContainer>
      <AppHeader onBack={() => navigateTo('dashboard')} center="Настройки" />

      <div
        style={{
          padding: 'var(--space-4)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Icon size={20} color="var(--text-secondary)" aria-hidden="true" />
          <div>
            <div
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                marginTop: 'var(--space-1)',
              }}
            >
              {hint}
            </div>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          aria-label={label}
          onClick={handleToggle}
          style={{
            width: 52,
            height: 30,
            padding: 3,
            flexShrink: 0,
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-strong)',
            background: isDark ? 'var(--accent)' : 'var(--bg-elevated)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isDark ? 'flex-end' : 'flex-start',
            transition: 'background 0.15s ease',
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
            }}
          />
        </button>
      </div>
    </ScreenContainer>
  );
}
