import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { act, render, screen, cleanup, fireEvent } from '@testing-library/react';
import { useThemeController } from '../useThemeController';
import { publishTelegramTheme } from '@/platform/telegramTheme';

const KEY = 'lx-theme';

function Probe() {
  const { resolved, toggle } = useThemeController();
  return createElement(
    'button',
    { 'data-theme-resolved': resolved, onClick: toggle },
    resolved
  );
}

type MqListener = (e: { matches: boolean; media: string }) => void;

// Controllable matchMedia: keeps the SAME object across the hook's lifetime so the
// effect registers on the instance the test later fires. Also exposes trigger()
// so a change can be simulated through the listener the hook actually attached.
let mqListeners: MqListener[] = [];
let mqMatches = false;

function stubMatchMedia(prefersDark: boolean) {
  mqMatches = prefersDark;
  mqListeners = [];
  const mql = {
    get matches() {
      return mqMatches;
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addListener: (fn: MqListener) => {
      mqListeners.push(fn);
    },
    removeListener: (fn: MqListener) => {
      mqListeners = mqListeners.filter((l) => l !== fn);
    },
    addEventListener: (_t: string, fn: MqListener) => {
      mqListeners.push(fn);
    },
    removeEventListener: (_t: string, fn: MqListener) => {
      mqListeners = mqListeners.filter((l) => l !== fn);
    },
    dispatchEvent: () => true,
  };
  vi.stubGlobal('matchMedia', () => mql);
}

function emitMqChange(prefersDark: boolean) {
  mqMatches = prefersDark;
  mqListeners.forEach((fn) => fn({ matches: prefersDark, media: '(prefers-color-scheme: dark)' }));
}

const resolvedOf = () => screen.getByRole('button').getAttribute('data-theme-resolved');

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-theme-source');
  // The controller now reads the SDK-free bridge; the SDK adapter publishes into it
  // (see platform/telegram_adapter.ts). Reset it to "not in Telegram".
  publishTelegramTheme({ inTMA: false, isDark: undefined });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-theme-source');
  vi.unstubAllGlobals();
});

describe('useThemeController — mount', () => {
  it('inherits the OS theme when storage is empty', () => {
    stubMatchMedia(true);
    render(createElement(Probe));
    expect(resolvedOf()).toBe('dark');
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme-source')).toBe('inherit');
  });

  it('inherits light from the OS', () => {
    stubMatchMedia(false);
    render(createElement(Probe));
    expect(resolvedOf()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('a stored manual choice wins over the OS', () => {
    stubMatchMedia(true);
    localStorage.setItem(KEY, 'light');
    render(createElement(Probe));
    expect(resolvedOf()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme-source')).toBe('manual');
  });
});

describe('useThemeController — toggle', () => {
  it('flips away from the system theme and pins the choice', () => {
    stubMatchMedia(false);
    render(createElement(Probe));
    fireEvent.click(screen.getByRole('button'));
    expect(localStorage.getItem(KEY)).toBe('dark');
    expect(resolvedOf()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme-source')).toBe('manual');
  });

  it('flips back to the system theme and clears the key', () => {
    stubMatchMedia(false);
    render(createElement(Probe));
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(localStorage.getItem(KEY)).toBe('dark');
    fireEvent.click(btn);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(resolvedOf()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme-source')).toBe('inherit');
  });

  it('never stores the literal system', () => {
    stubMatchMedia(false);
    render(createElement(Probe));
    fireEvent.click(screen.getByRole('button'));
    expect(localStorage.getItem(KEY)).not.toBe('system');
  });

  it('works from a manual choice back to inherit', () => {
    stubMatchMedia(true);
    localStorage.setItem(KEY, 'light');
    render(createElement(Probe));
    expect(resolvedOf()).toBe('light');
    fireEvent.click(screen.getByRole('button'));
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(resolvedOf()).toBe('dark');
  });
});

// NOTE: the adapter reads themeParams.isDark defensively (readTelegramIsDark), and
// an unreadable signal is published as undefined, which the controller must treat as
// untrusted — covered by "treats undefined from the signal as untrusted" below.
describe('useThemeController — Telegram signal', () => {
  it('uses the published colour scheme for the system theme inside Telegram', () => {
    publishTelegramTheme({ inTMA: true, isDark: true });
    stubMatchMedia(false);
    render(createElement(Probe));
    expect(resolvedOf()).toBe('dark');
  });

  it('toggle inside Telegram compares against the client theme', () => {
    publishTelegramTheme({ inTMA: true, isDark: true });
    stubMatchMedia(false);
    render(createElement(Probe));
    fireEvent.click(screen.getByRole('button'));
    expect(localStorage.getItem(KEY)).toBe('light');
    expect(resolvedOf()).toBe('light');
  });

  it('a manual choice overrides the Telegram signal entirely', () => {
    publishTelegramTheme({ inTMA: true, isDark: true });
    localStorage.setItem(KEY, 'light');
    render(createElement(Probe));
    // Telegram says dark, the pinned choice says light, and the choice wins.
    expect(resolvedOf()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme-source')).toBe('manual');
  });


  it('treats undefined from the signal as untrusted and uses matchMedia', () => {
    publishTelegramTheme({ inTMA: true, isDark: undefined });
    stubMatchMedia(false);
    render(createElement(Probe));
    expect(resolvedOf()).toBe('light');
  });

  it('reacts to the OS preference changing after mount', () => {
    stubMatchMedia(false);
    render(createElement(Probe));
    expect(resolvedOf()).toBe('light');
    act(() => {
      emitMqChange(true);
    });
    expect(resolvedOf()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
