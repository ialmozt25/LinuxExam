import { describe, it, expect, vi, beforeEach } from 'vitest';
import { impact, notify } from '../useTelegramHaptics';

const mocks = vi.hoisted(() => ({
  isTMA: vi.fn<() => boolean>(),
  impactOccurred: Object.assign(vi.fn(), { isAvailable: vi.fn<() => boolean>() }),
  notificationOccurred: Object.assign(vi.fn(), { isAvailable: vi.fn<() => boolean>() }),
}));

vi.mock('@telegram-apps/sdk-react', () => ({
  isTMA: mocks.isTMA,
  hapticFeedback: {
    impactOccurred: mocks.impactOccurred,
    notificationOccurred: mocks.notificationOccurred,
  },
}));

describe('useTelegramHaptics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isTMA.mockReturnValue(false);
    mocks.impactOccurred.isAvailable.mockReturnValue(true);
    mocks.notificationOccurred.isAvailable.mockReturnValue(true);
  });

  it('is a no-op outside Telegram (Web mode)', () => {
    expect(() => impact('light')).not.toThrow();
    expect(() => notify('success')).not.toThrow();
    expect(mocks.impactOccurred).not.toHaveBeenCalled();
    expect(mocks.notificationOccurred).not.toHaveBeenCalled();
  });

  it('fires impact haptics inside Telegram', () => {
    mocks.isTMA.mockReturnValue(true);

    impact('medium');

    expect(mocks.impactOccurred).toHaveBeenCalledWith('medium');
  });

  it('fires notification haptics inside Telegram', () => {
    mocks.isTMA.mockReturnValue(true);

    notify('error');

    expect(mocks.notificationOccurred).toHaveBeenCalledWith('error');
  });

  it('respects isAvailable() and never throws', () => {
    mocks.isTMA.mockReturnValue(true);
    mocks.impactOccurred.isAvailable.mockReturnValue(false);

    expect(() => impact()).not.toThrow();
    expect(mocks.impactOccurred).not.toHaveBeenCalled();
  });
});