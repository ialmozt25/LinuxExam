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
  migrateThemeStorage,
  readManualChoice,
  resolveTheme,
} from '../theme';
import Settings from '@/presentation/screens/Settings';
import { THEME_CHANGE_EVENT } from '@/hooks/useThemeController';

const SETTINGS_EL = createElement(Settings);

const KEY = 'lx-theme';
const MANUAL = 'lx-theme-manual';

const mocks = vi.hoisted(() => ({
  navigateTo: vi.fn(),
  backButton: vi.fn(),
  isTMA: vi.fn<() => boolean>(),
  isDark: vi.fn<() => boolean | undefined>(),
}));

vi.mock('@/store/quizStore', () => ({
  useQuizStore: (selector: (s: { navigateTo: typeof mocks.navigateTo }) => unknown) =>
    selector({ navigateTo: mocks.navigateTo }),
}));

vi.mock('@/hooks/useTelegramBackButton', () => ({
  useTelegramBackButton: mocks.backButton,
}));

vi.mock('@telegram-apps/sdk-react', () => ({
  isTMA: mocks.isTMA,
  themeParams: { isDark: mocks.isDark },
}));

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

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-theme-source');
  mocks.navigateTo.mockClear();
  mocks.isTMA.mockReset();
  mocks.isDark.mockReset();
  mocks.isTMA.mockReturnValue(false);
  mocks.isDark.mockReturnValue(undefined);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-theme-source');
  vi.unstubAllGlobals();
});

describe('migrateThemeStorage', () => {
  it("'system' removes the key (absence means inherit)", () => {
    localStorage.setItem(KEY, 'system');
    migrateThemeStorage();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("keeps an explicit 'light'", () => {
    localStorage.setItem(KEY, 'light');
    migrateThemeStorage();
    expect(localStorage.getItem(KEY)).toBe('light');
  });

  it("keeps an explicit 'dark'", () => {
    localStorage.setItem(KEY, 'dark');
    migrateThemeStorage();
    expect(localStorage.getItem(KEY)).toBe('dark');
  });

  it('promotes lx-theme-manual when lx-theme is absent', () => {
    localStorage.setItem(MANUAL, 'dark');
    migrateThemeStorage();
    expect(localStorage.getItem(KEY)).toBe('dark');
    expect(localStorage.getItem(MANUAL)).toBeNull();
  });

  it('always removes lx-theme-manual', () => {
    localStorage.setItem(KEY, 'light');
    localStorage.setItem(MANUAL, 'dark');
    migrateThemeStorage();
    expect(localStorage.getItem(KEY)).toBe('light');
    expect(localStorage.getItem(MANUAL)).toBeNull();
  });

  it('is idempotent: two runs equal one run', () => {
    localStorage.setItem(KEY, 'system');
    localStorage.setItem(MANUAL, 'light');
    migrateThemeStorage();
    const afterFirst = JSON.stringify([localStorage.getItem(KEY), localStorage.getItem(MANUAL)]);
    migrateThemeStorage();
    const afterSecond = JSON.stringify([localStorage.getItem(KEY), localStorage.getItem(MANUAL)]);
    expect(afterSecond).toBe(afterFirst);
    expect(localStorage.getItem(MANUAL)).toBeNull();
  });

  it('ignores a junk manual value', () => {
    localStorage.setItem(MANUAL, 'purple');
    migrateThemeStorage();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(localStorage.getItem(MANUAL)).toBeNull();
  });
});

describe('getThemeChoice normalisation', () => {
  it('absent key reports system', () => {
    expect(getThemeChoice()).toBe('system');
  });
  it('legacy system reports system', () => {
    localStorage.setItem(KEY, 'system');
    expect(getThemeChoice()).toBe('system');
  });
  it('explicit values pass through', () => {
    localStorage.setItem(KEY, 'light');
    expect(getThemeChoice()).toBe('light');
    localStorage.setItem(KEY, 'dark');
    expect(getThemeChoice()).toBe('dark');
  });
  it('junk reports system', () => {
    localStorage.setItem(KEY, 'purple');
    expect(getThemeChoice()).toBe('system');
  });
});

describe('resolveTheme — Telegram signal beats matchMedia', () => {
  it('(system, TG dark) resolves to dark', () => {
    expect(resolveTheme('system', { inTelegram: true, telegramIsDark: true })).toBe('dark');
  });
  it('(system, TG light) resolves to light even when the OS is dark', () => {
    stubMatchMedia(true);
    expect(resolveTheme('system', { inTelegram: true, telegramIsDark: false })).toBe('light');
  });
  it('(system, no TG signal) falls back to matchMedia', () => {
    stubMatchMedia(true);
    expect(resolveTheme('system', { inTelegram: false, telegramIsDark: undefined })).toBe('dark');
    stubMatchMedia(false);
    expect(resolveTheme('system', { inTelegram: false, telegramIsDark: undefined })).toBe('light');
  });
  it('(system, no options) falls back to matchMedia', () => {
    stubMatchMedia(false);
    expect(resolveTheme('system')).toBe('light');
  });
  it('(system, TG in browser but undefined signal) falls back, not dark', () => {
    stubMatchMedia(false);
    expect(resolveTheme('system', { inTelegram: true, telegramIsDark: undefined })).toBe('light');
  });
  it('explicit choice ignores every signal', () => {
    expect(resolveTheme('light', { inTelegram: true, telegramIsDark: true })).toBe('light');
    expect(resolveTheme('dark', { inTelegram: false, telegramIsDark: false })).toBe('dark');
  });
});

describe('applyThemeChoice', () => {
  it('system clears nothing but marks inherit', () => {
    stubMatchMedia(false);
    applyThemeChoice('system');
    expect(document.documentElement.getAttribute('data-theme-source')).toBe('inherit');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
  it('an explicit choice marks manual', () => {
    applyThemeChoice('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme-source')).toBe('manual');
  });
  it('uses the Telegram signal when provided (the P0 bug)', () => {
    stubMatchMedia(true);
    applyThemeChoice('system', false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    applyThemeChoice('system', true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
  it('falls back to matchMedia when the signal is undefined', () => {
    stubMatchMedia(false);
    applyThemeChoice('system', undefined);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});

describe('applyThemeState persistence', () => {
  it('writes an explicit choice', () => {
    applyThemeState({ choice: 'dark', manual: 'dark', followSystem: false });
    expect(localStorage.getItem(KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme-source')).toBe('manual');
  });
  it('removes the key when following the system', () => {
    localStorage.setItem(KEY, 'dark');
    applyThemeState({ choice: 'system', manual: null, followSystem: true });
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(document.documentElement.getAttribute('data-theme-source')).toBe('inherit');
  });
  it('never persists system as a value', () => {
    applyThemeState({ choice: 'system', manual: null, followSystem: true });
    expect(localStorage.getItem(KEY)).not.toBe('system');
  });
  it('getThemeState reports manual null while inheriting', () => {
    expect(getThemeState().manual).toBeNull();
    expect(getFollowSystem()).toBe(true);
    localStorage.setItem(KEY, 'light');
    expect(getThemeState().manual).toBe('light');
    expect(getFollowSystem()).toBe(false);
  });
  it('getSystemTheme reads matchMedia', () => {
    stubMatchMedia(true);
    expect(getSystemTheme()).toBe('dark');
    stubMatchMedia(false);
    expect(getSystemTheme()).toBe('light');
  });
  it('readManualChoice falls back to light while inheriting', () => {
    expect(readManualChoice()).toBe('light');
    localStorage.setItem(KEY, 'dark');
    expect(readManualChoice()).toBe('dark');
  });
});

describe('Settings switch', () => {
  it('label and aria-checked follow the resolved theme (OS light)', () => {
    stubMatchMedia(false);
    render(SETTINGS_EL);
    const sw = screen.getByRole('switch');
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Светлая тема')).toBeTruthy();
    expect(sw.getAttribute('aria-label')).toBe('Светлая тема');
  });

  it('label and aria-checked follow the resolved theme (OS dark)', () => {
    stubMatchMedia(true);
    render(SETTINGS_EL);
    const sw = screen.getByRole('switch');
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Тёмная тема')).toBeTruthy();
    expect(sw.getAttribute('aria-label')).toBe('Тёмная тема');
  });

  it('uses the Telegram signal over the OS when available', () => {
    stubMatchMedia(false);
    mocks.isTMA.mockReturnValue(true);
    mocks.isDark.mockReturnValue(true);
    render(SETTINGS_EL);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  it('shows the inherit hint with the current value', () => {
    stubMatchMedia(false);
    render(SETTINGS_EL);
    expect(screen.getByText(/Следует системной теме/)).toBeTruthy();
    expect(screen.getByText(/сейчас: светлая/)).toBeTruthy();
  });

  it('shows the manual hint after an explicit choice', () => {
    stubMatchMedia(false);
    localStorage.setItem(KEY, 'dark');
    render(SETTINGS_EL);
    expect(screen.getByText('Ручной выбор')).toBeTruthy();
  });

  it('toggling from inherit pins the opposite of the system theme', () => {
    stubMatchMedia(false);
    render(SETTINGS_EL);
    fireEvent.click(screen.getByRole('switch'));
    expect(localStorage.getItem(KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme-source')).toBe('manual');
  });

  it('toggling back to the system value clears the key (null, not empty)', () => {
    stubMatchMedia(false);
    render(SETTINGS_EL);
    const sw = screen.getByRole('switch');
    fireEvent.click(sw);
    expect(localStorage.getItem(KEY)).toBe('dark');
    fireEvent.click(sw);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(document.documentElement.getAttribute('data-theme-source')).toBe('inherit');
  });

  it('announces changes through the shared event', () => {
    stubMatchMedia(false);
    const spy = vi.fn();
    window.addEventListener(THEME_CHANGE_EVENT, spy);
    render(SETTINGS_EL);
    fireEvent.click(screen.getByRole('switch'));
    expect(spy).toHaveBeenCalled();
    window.removeEventListener(THEME_CHANGE_EVENT, spy);
  });

  it('back button navigates to the dashboard', () => {
    stubMatchMedia(false);
    render(SETTINGS_EL);
    expect(mocks.backButton).toHaveBeenCalled();
    const cb = mocks.backButton.mock.calls[0][0] as () => void;
    cb();
    expect(mocks.navigateTo).toHaveBeenCalledWith('dashboard');
  });
});
