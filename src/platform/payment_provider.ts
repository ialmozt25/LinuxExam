export interface PurchaseResult {
  success: boolean;
  error?: string;
}

export interface PaymentProvider {
  readonly id: 'yookassa' | 'telegram_stars' | 'stub';
  readonly label: string;
  readonly price: string;
  isAvailable(): boolean;
  purchase(): Promise<PurchaseResult>;
}

class StubPaymentProvider implements PaymentProvider {
  readonly id = 'stub' as const;
  readonly label = 'Купить за 490 ₽';
  readonly price = '490 ₽';

  isAvailable(): boolean {
    return true;
  }

  async purchase(): Promise<PurchaseResult> {
    // TODO(payments): replace with real YooKassa SDK in Step 5
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { success: true };
  }
}

// Singleton - do NOT instantiate inside React components
export const defaultPaymentProvider: PaymentProvider = new StubPaymentProvider();
