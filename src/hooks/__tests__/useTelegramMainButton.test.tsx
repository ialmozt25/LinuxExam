import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useTelegramMainButton,
  useMainButtonAvailable,
  isMainButtonAvailable,
} from '../useTelegramMainButton';

/**
 * Тесты spec 072: setup MainButton больше не «всё или ничего».
 *
 * Раньше единый try/catch глушил исключение и оставлял и `setParams`, и `onClick`
 * невыполненными — на устройстве кнопка не появлялась, а след терялся в
 * console.warn. Теперь части настраиваются независимо, а недоступный MainButton
 * становится виден вызывающему экрану (`useMainButtonAvailable`) для фолбэка.
 */

const mocks = vi.hoisted(() => ({
  isTMA: vi.fn<() => boolean>(),
  isMounted: vi.fn<() => boolean>(),
  isAvailable: vi.fn<() => boolean>(),
  setParams: vi.fn(),
  onClick: vi.fn(),
  offClick: vi.fn(),
  useSignal: vi.fn(),
}));

vi.mock('@telegram-apps/sdk-react', () => ({
  isTMA: mocks.isTMA,
  useSignal: mocks.useSignal,
  mainButton: {
    isMounted: mocks.isMounted,
    // `setParams.isAvailable` — computed-сигнал SDK; `useSignal` в тестах
    // просто возвращает текущее значение, подписку заменяет отдельный тест.
    setParams: Object.assign(mocks.setParams, { isAvailable: mocks.isAvailable }),
    onClick: mocks.onClick,
    offClick: mocks.offClick,
  },
}));

describe('useTelegramMainButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isTMA.mockReturnValue(false);
    mocks.isMounted.mockReturnValue(false);
    mocks.isAvailable.mockReturnValue(false);
    mocks.useSignal.mockImplementation((signal: () => unknown) => signal());
  });

  it('is a no-op outside Telegram (Web mode)', () => {
    const cb = vi.fn();

    expect(() => renderHook(() => useTelegramMainButton('X', cb))).not.toThrow();
    expect(mocks.setParams).not.toHaveBeenCalled();
    expect(mocks.onClick).not.toHaveBeenCalled();
  });

  it('applies text/visibility/enabled and registers the click handler', () => {
    mocks.isTMA.mockReturnValue(true);
    mocks.isMounted.mockReturnValue(true);

    renderHook(() => useTelegramMainButton('Продолжить', vi.fn(), false, true));

    expect(mocks.setParams).toHaveBeenCalledWith({
      text: 'Продолжить',
      isVisible: true,
      isEnabled: false,
    });
    expect(mocks.onClick).toHaveBeenCalledTimes(1);
  });

  it('routes the SDK click to the latest callback without re-running the effect', () => {
    mocks.isTMA.mockReturnValue(true);
    mocks.isMounted.mockReturnValue(true);
    const first = vi.fn();
    const second = vi.fn();

    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) => useTelegramMainButton('X', cb),
      { initialProps: { cb: first } }
    );
    const handler = mocks.onClick.mock.calls[0][0] as () => void;

    rerender({ cb: second });
    handler();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(mocks.onClick).toHaveBeenCalledTimes(1);
  });

  it('offClick идёт до hide при размонтировании', () => {
    mocks.isTMA.mockReturnValue(true);
    mocks.isMounted.mockReturnValue(true);

    const { unmount } = renderHook(() => useTelegramMainButton('X', vi.fn()));
    unmount();

    expect(mocks.offClick).toHaveBeenCalledTimes(1);
    expect(mocks.setParams).toHaveBeenCalledWith({ isVisible: false });
    // порядок: сначала снять обработчик, потом скрыть кнопку
    const offOrder = mocks.offClick.mock.invocationCallOrder[0]!;
    const hideCalls = mocks.setParams.mock.invocationCallOrder;
    const hideOrder = hideCalls[hideCalls.length - 1]!;
    expect(offOrder).toBeLessThan(hideOrder);
  });

  it('spec 072: падение setParams не отменяет регистрацию onClick', () => {
    mocks.isTMA.mockReturnValue(true);
    mocks.isMounted.mockReturnValue(true);
    mocks.setParams.mockImplementationOnce(() => {
      throw new Error('setParams unavailable');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => renderHook(() => useTelegramMainButton('X', vi.fn()))).not.toThrow();

    // Главное: обработчик зарегистрирован, несмотря на провал настройки текста.
    expect(mocks.onClick).toHaveBeenCalledTimes(1);
    // И повторная попытка настройки — не «тихая»: след остаётся в консоли.
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('spec 072: падение onClick не мешает применить состояние кнопки', () => {
    mocks.isTMA.mockReturnValue(true);
    mocks.isMounted.mockReturnValue(true);
    mocks.onClick.mockImplementationOnce(() => {
      throw new Error('onClick unavailable');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderHook(() => useTelegramMainButton('Дальше', vi.fn(), true, true));

    expect(mocks.setParams).toHaveBeenCalledWith({
      text: 'Дальше',
      isVisible: true,
      isEnabled: true,
    });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('spec 072: кнопка смонтировалась позже — настройка повторяется', () => {
    mocks.isTMA.mockReturnValue(true);
    // Первый рендер: MainButton ещё не смонтирован.
    mocks.isMounted.mockReturnValue(false);
    mocks.useSignal.mockImplementation((signal: () => unknown) => signal());

    const { rerender } = renderHook(() => useTelegramMainButton('X', vi.fn()));
    // Попытка настройки была и без смонтированной кнопки: не «ждать молча», а
    // применить и не упасть.
    const setups = () =>
      mocks.setParams.mock.calls.filter(([params]) => 'text' in (params as object)).length;
    expect(setups()).toBe(1);

    // Кнопка появилась: сигнал сменился → эффект перезапускается.
    mocks.isMounted.mockReturnValue(true);
    act(() => {
      rerender();
    });

    expect(setups()).toBe(2);
    expect(mocks.onClick).toHaveBeenCalledTimes(2);
  });
});

describe('useMainButtonAvailable (spec 072)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useSignal.mockImplementation((signal: () => unknown) => signal());
  });

  it('false вне Telegram', () => {
    mocks.isTMA.mockReturnValue(false);
    mocks.isMounted.mockReturnValue(true);
    mocks.isAvailable.mockReturnValue(true);

    expect(renderHook(() => useMainButtonAvailable()).result.current).toBe(false);
  });

  it('false в TMA, когда MainButton недоступен', () => {
    mocks.isTMA.mockReturnValue(true);
    mocks.isMounted.mockReturnValue(false);
    mocks.isAvailable.mockReturnValue(false);

    expect(renderHook(() => useMainButtonAvailable()).result.current).toBe(false);
  });

  it('true в TMA, когда MainButton смонтирован и доступен', () => {
    mocks.isTMA.mockReturnValue(true);
    mocks.isMounted.mockReturnValue(true);
    mocks.isAvailable.mockReturnValue(true);

    expect(renderHook(() => useMainButtonAvailable()).result.current).toBe(true);
  });

  it('isMainButtonAvailable не бросает, если SDK-вызов падает', () => {
    mocks.isAvailable.mockImplementation(() => {
      throw new Error('SDK not initialized');
    });

    expect(isMainButtonAvailable()).toBe(false);
  });
});
