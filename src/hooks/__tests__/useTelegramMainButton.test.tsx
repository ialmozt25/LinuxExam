import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTelegramMainButton } from '../useTelegramMainButton';

const mocks = vi.hoisted(() => ({
  isTMA: vi.fn<() => boolean>(),
  isMounted: vi.fn<() => boolean>(),
  setParams: vi.fn(),
  onClick: vi.fn(),
  offClick: vi.fn(),
}));

vi.mock('@telegram-apps/sdk-react', () => ({
  isTMA: mocks.isTMA,
  mainButton: {
    isMounted: mocks.isMounted,
    setParams: mocks.setParams,
    onClick: mocks.onClick,
    offClick: mocks.offClick,
  },
}));

describe('useTelegramMainButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isTMA.mockReturnValue(false);
    mocks.isMounted.mockReturnValue(false);
  });

  it('is a no-op outside Telegram (Web mode)', () => {
    const cb = vi.fn();

    expect(() => renderHook(() => useTelegramMainButton('X', cb))).not.toThrow();
    expect(mocks.setParams).not.toHaveBeenCalled();
    expect(mocks.onClick).not.toHaveBeenCalled();
  });

  it('does nothing when the MainButton is not mounted', () => {
    mocks.isTMA.mockReturnValue(true);
    mocks.isMounted.mockReturnValue(false);

    renderHook(() => useTelegramMainButton('X', vi.fn()));

    expect(mocks.setParams).not.toHaveBeenCalled();
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

  it('unregisters the handler on unmount', () => {
    mocks.isTMA.mockReturnValue(true);
    mocks.isMounted.mockReturnValue(true);

    const { unmount } = renderHook(() => useTelegramMainButton('X', vi.fn()));
    unmount();

    expect(mocks.offClick).toHaveBeenCalledTimes(1);
  });
});