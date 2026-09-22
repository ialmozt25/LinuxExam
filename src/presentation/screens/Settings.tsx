import { useState } from 'react';
import { useQuizStore } from '@/store/quizStore';
import { AppHeader } from '@/presentation/components/AppHeader';
import { ScreenContainer } from '@/presentation/components/ScreenContainer';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { THEME_CHANGE_EVENT } from '@/hooks/useThemeController';
import {
  applyThemeState,
  getThemeState,
  setFollowSystem,
  type ThemeChoice,
} from '@/utils/theme';

/**
 * Theme settings.
 *
 * One follow-switch plus one light/dark switch, backed by two localStorage keys:
 * `lx-theme` (the persisted choice, 'system' while following) and
 * `lx-theme-manual` (the last explicit light/dark pick, so turning the switch off
 * returns to what the user last chose instead of an arbitrary default).
 */
export default function Settings() {
  const navigateTo = useQuizStore((s) => s.navigateTo);
  const [state, setState] = useState(() => getThemeState());

  useTelegramBackButton(() => navigateTo('dashboard'));

  const commit = (next: { follow: boolean; manual: 'light' | 'dark' }) => {
    if (next.follow) {
      setFollowSystem(true);
    } else {
      // Pin the manual key first, then the choice, so both stay coherent.
      const choice: ThemeChoice = next.manual;
      window.localStorage.setItem('lx-theme-manual', next.manual);
      window.localStorage.setItem('lx-theme', choice);
    }
    const fresh = getThemeState();
    setState(fresh);
    applyThemeState(fresh);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  const manual = state.manual;
  const isDark = manual === 'dark';

  return (
    <ScreenContainer>
      <AppHeader
        onBack={() => navigateTo('dashboard')}
        center="Настройки"
      />

      <h2
        style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          margin: 0,
          marginBottom: 'var(--space-3)',
        }}
      >
        Тема оформления
      </h2>

      {/* Follow Telegram / system */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-3)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={state.followSystem}
          onChange={(e) =>
            commit({ follow: e.target.checked, manual })
          }
          style={{ width: 20, height: 20, flexShrink: 0 }}
        />
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
          Следовать Telegram / системе
        </span>
      </label>

      {/* Light / dark switch */}
      <div
        style={{
          marginTop: 'var(--space-2)',
          padding: 'var(--space-3)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
        }}
      >
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
          {isDark ? 'Тёмная' : 'Светлая'}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          aria-disabled={state.followSystem}
          aria-label="Тёмная тема"
          onClick={() => {
            // aria-disabled is advisory; the handler must ignore the click.
            if (state.followSystem) return;
            commit({ follow: false, manual: isDark ? 'light' : 'dark' });
          }}
          style={{
            width: 52,
            height: 30,
            padding: 3,
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-strong)',
            background: isDark ? 'var(--accent)' : 'var(--bg-elevated)',
            cursor: state.followSystem ? 'not-allowed' : 'pointer',
            opacity: state.followSystem ? 0.5 : 1,
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
