import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import {
  applyThemeChoice,
  applyThemeState,
  getFollowSystem,
  getSystemTheme,
  getThemeChoice,
  getThemeState,
  readManualChoice,
  resolveTheme,
  setFollowSystem,
  type ThemeSignals,
} from '../theme';
import Settings from '@/presentation/screens/Settings';
import { THEME_CHANGE_EVENT } from '@/hooks/useThemeController';

const mocks = vi.hoisted(() => ({
  navigateTo: vi.fn(),
  backButton: vi.fn(),
}));

vi.mock('@/store/quizStore', () => ({
  useQuizStore: (selector: (s: { navigateTo: typeof mocks.navigateTo }) => unknown) =>
    selector({ navigateTo: mocks.navigateTo }),
}));

vi.mock('@/hooks/useTelegramBackButton', () => ({
  useTelegramBackButton: mocks.backButton,
}));

// createElement instead of JSX keeps this a .ts file (the allowed-file list
// names theme.test.ts).
const SETTINGS_EL = createElement(Settings);

function stubMatchMedia(prefersDark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('dark') ? prefersDark : !prefersDark,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

const tg = (isDark: boolean): ThemeSignals => ({
  inTelegram: true,
  telegramIsDark: isDark,
  osIsDark: !isDark,
});
const browser = (isDark: boolean): ThemeSignals => ({
  inTelegram: false,
  telegramIsDark: !isDark,
  osIsDark: isDark,
});

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-theme-source');
  mocks.navigateTo.mockClear();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-theme-source');
  vi.unstubAllGlobals();
});

describe('resolveTheme — system follows Telegram inside TG, OS outside', () => {
  it('(system, TG, dark) resolves to dark', () => {
    expect(resolveTheme('system', tg(true))).toBe('dark');
  });
  it('(system, TG, light) resolves to light', () => {
    expect(resolveTheme('system', tg(false))).toBe('light');
  });
  it('(system, browser, dark) resolves from matchMedia', () => {
    expect(resolveTheme('system', browser(true))).toBe('dark');
  });
  it('(light, any) ignores Telegram and OS', () => {
    expect(resolveTheme('light', tg(true))).toBe('light');
    expect(resolveTheme('light', browser(true))).toBe('light');
  });
  it('(dark, any) ignores Telegram and OS', () => {
    expect(resolveTheme('dark', tg(false))).toBe('dark');
    expect(resolveTheme('dark', browser(false))).toBe('dark');
  });
});

describe('legacy exports still behave', () => {
  it('getThemeChoice defaults to system', () => {
    expect(getThemeChoice()).toBe('system');
  });
  it('getSystemTheme reads matchMedia', () => {
    stubMatchMedia(true);
    expect(getSystemTheme()).toBe('dark');
    stubMatchMedia(false);
    expect(getSystemTheme()).toBe('light');
  });
  it('applyThemeChoice sets data-theme and source by choice', () => {
    applyThemeChoice('system');
    expect(document.documentElement.getAttribute('data-theme-source')).toBe('inherit');
    applyThemeChoice('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme-source')).toBe('manual');
  });
});

describe('follow switch and manual key', () => {
  it('system sets data-theme-source=inherit', () => {
    applyThemeChoice('system');
    expect(document.documentElement.getAttribute('data-theme-source')).toBe('inherit');
  });
  it('setFollowSystem(true) keeps the last manual choice', () => {
    setFollowSystem(false);
    window.localStorage.setItem('lx-theme-manual', 'light');
    window.localStorage.setItem('lx-theme', 'light');
    setFollowSystem(true);
    expect(getFollowSystem()).toBe(true);
    expect(readManualChoice()).toBe('light');
    expect(getThemeChoice()).toBe('system');
  });
  it('applyThemeState writes the source derived from followSystem', () => {
    applyThemeState({ choice: 'dark', manual: 'dark', followSystem: false });
    expect(document.documentElement.getAttribute('data-theme-source')).toBe('manual');
    applyThemeState({ choice: 'system', manual: 'dark', followSystem: true });
    expect(document.documentElement.getAttribute('data-theme-source')).toBe('inherit');
  });
  it('getThemeState reports a coherent triple', () => {
    setFollowSystem(false);
    window.localStorage.setItem('lx-theme', 'dark');
    const s = getThemeState();
    expect(s.choice).toBe('dark');
    expect(s.followSystem).toBe(false);
    expect(s.manual).toBe('dark');
  });
});

describe('Settings screen', () => {
  it('switch has aria-disabled while following, and ignores clicks', () => {
    applyThemeChoice('system');
    render(SETTINGS_EL);
    const sw = screen.getByRole('switch');
    expect(sw.getAttribute('aria-disabled')).toBe('true');
    const before = document.documentElement.getAttribute('data-theme');
    fireEvent.click(sw);
    expect(getFollowSystem()).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe(before);
  });

  it('unchecking the follow box and flipping the switch picks a manual theme', () => {
    applyThemeChoice('system');
    render(SETTINGS_EL);
    fireEvent.click(screen.getByRole('checkbox'));
    const sw = screen.getByRole('switch');
    expect(sw.getAttribute('aria-disabled')).toBe('false');
    fireEvent.click(sw);
    expect(getFollowSystem()).toBe(false);
    expect(document.documentElement.getAttribute('data-theme-source')).toBe('manual');
  });

  it('back button navigates to the dashboard', () => {
    render(SETTINGS_EL);
    expect(mocks.backButton).toHaveBeenCalled();
    const cb = mocks.backButton.mock.calls[0][0] as () => void;
    cb();
    expect(mocks.navigateTo).toHaveBeenCalledWith('dashboard');
  });

  it('announces theme changes through the shared event', () => {
    applyThemeChoice('system');
    const spy = vi.fn();
    window.addEventListener(THEME_CHANGE_EVENT, spy);
    render(SETTINGS_EL);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(spy).toHaveBeenCalled();
    window.removeEventListener(THEME_CHANGE_EVENT, spy);
  });
});
