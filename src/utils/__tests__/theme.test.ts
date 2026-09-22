import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getThemeChoice, getSystemTheme, resolveTheme, applyThemeChoice } from '../theme';

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

describe('getThemeChoice', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });
  afterEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('returns system by default', () => {
    expect(getThemeChoice()).toBe('system');
  });

  it('returns saved choice', () => {
    localStorage.setItem('lx-theme', 'light');
    expect(getThemeChoice()).toBe('light');
    localStorage.setItem('lx-theme', 'dark');
    expect(getThemeChoice()).toBe('dark');
    localStorage.setItem('lx-theme', 'system');
    expect(getThemeChoice()).toBe('system');
  });

  it('returns system on invalid value', () => {
    localStorage.setItem('lx-theme', 'purple');
    expect(getThemeChoice()).toBe('system');
  });
});

describe('getSystemTheme', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns dark when prefers dark', () => {
    stubMatchMedia(true);
    expect(getSystemTheme()).toBe('dark');
  });

  it('returns light when prefers light', () => {
    stubMatchMedia(false);
    expect(getSystemTheme()).toBe('light');
  });
});

describe('resolveTheme', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('resolves system to OS preference', () => {
    stubMatchMedia(true);
    expect(resolveTheme('system')).toBe('dark');
  });

  it('explicit choice ignores OS', () => {
    stubMatchMedia(true);
    expect(resolveTheme('light')).toBe('light');
  });
});

describe('applyThemeChoice', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });
  afterEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    vi.unstubAllGlobals();
  });

  it('sets data-theme attribute to resolved value', () => {
    stubMatchMedia(true);
    applyThemeChoice('system');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    applyThemeChoice('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    applyThemeChoice('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('persists choice to localStorage', () => {
    applyThemeChoice('light');
    expect(localStorage.getItem('lx-theme')).toBe('light');
  });
});
