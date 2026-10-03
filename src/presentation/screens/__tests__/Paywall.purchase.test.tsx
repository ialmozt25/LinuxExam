import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Paywall from '@/presentation/screens/Paywall';
import { useQuizStore } from '@/store/quizStore';

/**
 * spec 064 — поток покупки на экране Paywall.
 *
 * Платформенный слой подменяется целиком (`createInvoiceLink` / `openInvoice`):
 * его собственный контракт проверяется в `src/platform/__tests__/payment_provider.test.ts`,
 * а здесь важны решения ЭКРАНА — какой тариф выбран, что уходит в инвойс, что
 * происходит на `paid` (существующий `unlockPro()` + dashboard) и что на
 * `cancelled`/ошибке (сообщение, paywall остаётся, Pro не выдаётся).
 *
 * Окно инвойса Telegram в Playwright не воспроизводится, поэтому «оплата
 * прошла» здесь — единственное место, где этот путь исполняется автоматически.
 */

const mocks = vi.hoisted(() => ({
  createInvoiceLink: vi.fn(),
  openInvoice: vi.fn(),
}));

vi.mock('@/platform/payment_provider', () => ({
  createInvoiceLink: mocks.createInvoiceLink,
  openInvoice: mocks.openInvoice,
}));

const INVOICE_URL = 'https://t.me/invoice/abc';

beforeEach(async () => {
  await useQuizStore.getState().loadQuestions();
  useQuizStore.setState({ isPro: false, isPaywallVisible: true, currentScreen: 'paywall' });
  mocks.createInvoiceLink.mockReset();
  mocks.openInvoice.mockReset();
  mocks.createInvoiceLink.mockResolvedValue(INVOICE_URL);
  mocks.openInvoice.mockResolvedValue('paid');
});

describe('Paywall — тарифы (spec 064)', () => {
  it('рендерит три тарифа с data-testid и по умолчанию выбирает monthly', () => {
    render(<Paywall />);

    expect(screen.getByTestId('plan-monthly')).toBeChecked();
    expect(screen.getByTestId('plan-yearly')).not.toBeChecked();
    expect(screen.getByTestId('plan-lifetime')).not.toBeChecked();

    expect(screen.getByTestId('plan-monthly').closest('label')).toHaveTextContent('299 Stars');
    expect(screen.getByTestId('plan-yearly').closest('label')).toHaveTextContent('1499 Stars');
    expect(screen.getByTestId('plan-lifetime').closest('label')).toHaveTextContent('3999 Stars');

    expect(screen.getByTestId('paywall-buy')).toHaveTextContent('Купить за 299 Stars');
    // Контракт spec 063/059 сохраняется — кнопки на месте и с прежними id.
    expect(screen.getByTestId('paywall-later')).toBeInTheDocument();
    expect(screen.getByTestId('paywall-start-trial')).toBeInTheDocument();
  });

  it('выбор тарифа меняет подпись кнопки и plan в запросе инвойса', async () => {
    const user = userEvent.setup();
    render(<Paywall />);

    await user.click(screen.getByTestId('plan-yearly'));

    expect(screen.getByTestId('plan-yearly')).toBeChecked();
    expect(screen.getByTestId('paywall-buy')).toHaveTextContent('Купить за 1499 Stars');

    await user.click(screen.getByTestId('paywall-buy'));

    await waitFor(() => expect(mocks.createInvoiceLink).toHaveBeenCalledWith('yearly'));
    await waitFor(() => expect(mocks.openInvoice).toHaveBeenCalledWith(INVOICE_URL));
  });
});

describe('Paywall — покупка (spec 064)', () => {
  it('paid → unlockPro() и переход на dashboard, isPro персистится', async () => {
    const user = userEvent.setup();
    render(<Paywall />);

    await user.click(screen.getByTestId('paywall-buy'));

    await waitFor(() => expect(useQuizStore.getState().isPro).toBe(true));
    expect(useQuizStore.getState().currentScreen).toBe('dashboard');
    expect(useQuizStore.getState().isPaywallVisible).toBe(false);
  });

  it('cancelled → сообщение «Оплата не завершена», экран paywall, Pro не выдан', async () => {
    mocks.openInvoice.mockResolvedValue('cancelled');
    const user = userEvent.setup();
    render(<Paywall />);

    await user.click(screen.getByTestId('paywall-buy'));

    expect(await screen.findByText('Оплата не завершена')).toBeInTheDocument();
    expect(useQuizStore.getState().isPro).toBe(false);
    expect(useQuizStore.getState().currentScreen).toBe('paywall');
    expect(screen.getByTestId('paywall')).toBeInTheDocument();
  });

  it('failed → тоже не открывает Pro', async () => {
    mocks.openInvoice.mockResolvedValue('failed');
    const user = userEvent.setup();
    render(<Paywall />);

    await user.click(screen.getByTestId('paywall-buy'));

    expect(await screen.findByText('Оплата не завершена')).toBeInTheDocument();
    expect(useQuizStore.getState().isPro).toBe(false);
  });

  it('ненастроенный backend → понятное сообщение, Pro не выдан', async () => {
    mocks.createInvoiceLink.mockRejectedValue(new Error('Payment backend not configured'));
    const user = userEvent.setup();
    render(<Paywall />);

    await user.click(screen.getByTestId('paywall-buy'));

    expect(
      await screen.findByText('Не удалось начать оплату. Попробуйте позже.')
    ).toBeInTheDocument();
    expect(mocks.openInvoice).not.toHaveBeenCalled();
    expect(useQuizStore.getState().isPro).toBe(false);
    expect(useQuizStore.getState().currentScreen).toBe('paywall');
  });

  it('пока инвойс открыт, кнопка задизейблена (второй инвойс не создаётся)', async () => {
    let releaseInvoice: (url: string) => void = () => {};
    mocks.createInvoiceLink.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          releaseInvoice = resolve;
        })
    );

    const user = userEvent.setup();
    render(<Paywall />);

    const buy = screen.getByTestId('paywall-buy');
    await user.click(buy);

    await waitFor(() => expect(buy).toBeDisabled());
    // Повторный клик по задизейбленной кнопке не создаёт второй инвойс.
    await user.click(buy);
    expect(mocks.createInvoiceLink).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseInvoice(INVOICE_URL);
    });

    await waitFor(() => expect(useQuizStore.getState().isPro).toBe(true));
  });
});
