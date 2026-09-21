import './presentation/theme/tokens.css';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { useQuizStore } from '@/store/quizStore';
import { initTelegramSDK } from './platform/telegram_adapter';

async function bootstrap(): Promise<void> {
  // Optional DEV-only Telegram environment mock. Off by default so a plain browser
  // keeps reporting "Web mode" in the DEV badge (mockTelegramEnv saves launch params,
  // which makes isTMA() return true). Enable with VITE_MOCK_TELEGRAM=1 npm run dev.
  if (import.meta.env.DEV && import.meta.env.VITE_MOCK_TELEGRAM === '1') {
    const { mockTelegramEnv } = await import('@telegram-apps/sdk');
    mockTelegramEnv({
      launchParams: new URLSearchParams([
        ['tgWebAppVersion', '8.0'],
        ['tgWebAppPlatform', 'tdesktop'],
        [
          'tgWebAppThemeParams',
          JSON.stringify({ bg_color: '#1E1E1E', text_color: '#FFFFFF', button_color: '#2196F3' }),
        ],
        [
          'tgWebAppData',
          new URLSearchParams([
            ['user', JSON.stringify({ id: 123456789, first_name: 'Dev', username: 'dev_user' })],
            ['hash', 'test_hash'],
          ]).toString(),
        ],
      ]),
    });
  }

  await initTelegramSDK();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );

  if (import.meta.env.DEV) {
    window.__quizStore = useQuizStore;
  }
}

bootstrap();
