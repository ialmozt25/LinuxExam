import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { toKebabCase, useTelegramTheme } from '../useTelegramTheme';

// vi.hoisted keeps the mocks reachable without relying on vi.mocked() of the
// real (overloaded) isTMA declaration, which resolves to the async overload and
// would require mockReturnValue to return an AbortablePromise.
const mocks = vi.hoisted(() => ({
  isTMA: vi.fn<() => boolean>(),
  state: vi.fn<() => Partial<Record<string, string>> | undefined>(),
}));

vi.mock('@telegram-apps/sdk-react', () => ({
  isTMA: mocks.isTMA,
  themeParams: { state: mocks.state },
}));

const TG_VARS = [
  '--tg-theme-bg-color',
  '--tg-theme-secondary-bg-color',
  '--tg-theme-text-color',
  '--tg-theme-hint-color',
  '--tg-theme-button-color',
];

describe('useTelegramTheme', () => {
  beforeEach(() => {
    for (const name of TG_VARS) document.documentElement.style.removeProperty(name);
  });

  it('leaves CSS vars untouched when isTMA() is false (browser mode)', () => {
    mocks.isTMA.mockReturnValue(false);
    mocks.state.mockReturnValue({ bgColor: '#000000' });

    renderHook(() => useTelegramTheme());

    for (const name of TG_VARS) {
      expect(document.documentElement.style.getPropertyValue(name)).toBe('');
    }
  });

  it('applies camelCased state keys as kebab-cased --tg-theme-* vars', () => {
    mocks.isTMA.mockReturnValue(true);
    mocks.state.mockReturnValue({
      bgColor: '#101010',
      secondaryBgColor: '#202020',
      textColor: '#f0f0f0',
      hintColor: '#909090',
      buttonColor: '#2196f3',
    });

    renderHook(() => useTelegramTheme());

    const style = document.documentElement.style;
    expect(style.getPropertyValue('--tg-theme-bg-color')).toBe('#101010');
    expect(style.getPropertyValue('--tg-theme-secondary-bg-color')).toBe('#202020');
    expect(style.getPropertyValue('--tg-theme-text-color')).toBe('#f0f0f0');
    expect(style.getPropertyValue('--tg-theme-hint-color')).toBe('#909090');
    expect(style.getPropertyValue('--tg-theme-button-color')).toBe('#2196f3');
  });

  it('never throws and only warns when the SDK state is unavailable', () => {
    mocks.isTMA.mockReturnValue(true);
    mocks.state.mockReturnValue(undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => renderHook(() => useTelegramTheme())).not.toThrow();

    warn.mockRestore();
  });

  it('converts camelCase keys to kebab-case', () => {
    expect(toKebabCase('bgColor')).toBe('bg-color');
    expect(toKebabCase('secondaryBgColor')).toBe('secondary-bg-color');
    expect(toKebabCase('buttonTextColor')).toBe('button-text-color');
  });
});