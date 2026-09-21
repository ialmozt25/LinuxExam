import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTelegramBackButton } from '../useTelegramBackButton';

const mocks = vi.hoisted(() => ({
  isTMA: vi.fn<() => boolean>(),
  isMounted: vi.fn<() => boolean>(),
  show: vi.fn(),
  hide: vi.fn(),
  onClick: vi.fn(),
  offClick: vi.fn(),
}));

vi.mock('@telegram-apps/sdk-react', () => ({
  isTMA: mocks.isTMA,
  backButton: {
    isMounted: mocks.isMounted,
    show: mocks.show,
    hide: mocks.hide,
    onClick: mocks.onClick,
    offClick: mocks.offClick,
  },
}));

describe('useTelegramBackButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isTMA.mockReturnValue(false);
    mocks.isMounted.mockReturnValue(false);
  });

  it('is a no-op outside Telegram (Web mode)', () => {
    expect(() => renderHook(() => useTelegramBackButton(vi.fn()))).not.toThrow();
    expect(mocks.onClick).not.toHaveBeenCalled();
    expect(mocks.show).not.toHaveBeenCalled();
  });

  it('does nothing when the BackButton is not mounted', () => {
    mocks.isTMA.mockReturnValue(true);

    renderHook(() => useTelegramBackButton(vi.fn()));

    expect(mocks.onClick).not.toHaveBeenCalled();
  });

  it('shows the button and forwards clicks to the latest callback', () => {
    mocks.isTMA.mockReturnValue(true);
    mocks.isMounted.mockReturnValue(true);
    const onBack = vi.fn();

    renderHook(() => useTelegramBackButton(onBack));
    const handler = mocks.onClick.mock.calls[0][0] as () => void;
    handler();

    expect(mocks.show).toHaveBeenCalledTimes(1);
    expect(mocks.hide).not.toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('hides the button when disabled and unregisters on unmount', () => {
    mocks.isTMA.mockReturnValue(true);
    mocks.isMounted.mockReturnValue(true);

    const { unmount } = renderHook(() => useTelegramBackButton(vi.fn(), false));
    unmount();

    expect(mocks.hide).toHaveBeenCalled();
    expect(mocks.offClick).toHaveBeenCalledTimes(1);
  });
});