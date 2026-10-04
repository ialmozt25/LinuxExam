import './presentation/theme/tokens.css';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { useQuizStore } from '@/store/quizStore';
import { applyThemeChoice, getThemeChoice, migrateThemeStorage } from './utils/theme';

// Storage migration runs SYNCHRONOUSLY here, before the first theme read. Doing it
// in an effect would let the app paint the unmigrated value once and flash.
// migrateThemeStorage is idempotent, so it is safe to call on every boot.
migrateThemeStorage();

/**
 * Высота приложения = VISUAL viewport (spec 067).
 *
 * `#root` — скролл-контейнер, а sticky-футер липнет к его низу. Пока высота
 * бралась из layout viewport (`100v` + `100%`), на живом мобильном низ
 * контейнера уходил ниже видимой области: динамическая адресная строка и
 * жест-бар уменьшают VISUAL viewport, а layout остаётся прежним. Поэтому кнопка
 * «Следующий вопрос» была не видна без прокрутки.
 *
 * `visualViewport.height` — единственный источник фактически видимой высоты.
 * Значение кладётся в `--app-height` (tokens.css), откуда его берёт `#root`;
 * пока переменная не выставлена, работает CSS-фолбэк `100dvh`.
 *
 * Применяется ВСЕГДА, а не только при отсутствии `dvh`: Telegram WebView на
 * iOS/Android по-разному сообщает высоту и по-разному себя ведёт при показе
 * клавиатуры, поэтому единый JS-путь надёжнее, чем доверие к `dvh`.
 *
 * Возвращает cleanup: подписки снимаются, значение не остаётся «протухшим».
 */
function bindAppHeight(): () => void {
  const root = document.documentElement;
  const vv = window.visualViewport;

  const apply = (height: number | undefined): void => {
    // Ноль/NaN/отрицательное — не валидная высота: оставляем CSS-фолбэк.
    if (typeof height !== 'number' || !Number.isFinite(height) || height <= 0) return;
    root.style.setProperty('--app-height', `${Math.round(height)}px`);
  };

  if (!vv) {
    // Браузер без visualViewport: высота окна — лучшее приближение.
    const onResize = (): void => apply(window.innerHeight);
    onResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }

  const onVisualResize = (): void => apply(vv.height);
  onVisualResize();
  vv.addEventListener('resize', onVisualResize);
  // `scroll` события visualViewport ловят показ/скрытие адресной строки на
  // Android, где `resize` приходит не всегда.
  vv.addEventListener('scroll', onVisualResize);
  window.addEventListener('orientationchange', onVisualResize);
  return () => {
    vv.removeEventListener('resize', onVisualResize);
    vv.removeEventListener('scroll', onVisualResize);
    window.removeEventListener('orientationchange', onVisualResize);
  };
}

bindAppHeight();

// Resolve the stored theme before anything renders. The inline <head> script in
// index.html has already prevented the flash; this re-applies the same choice
// for the in-app path (and covers a storage change since that script ran).
// No Telegram signal is available at module scope, so this falls back to the OS
// preference; useThemeController corrects it on mount (see DECISION-011).
applyThemeChoice(getThemeChoice());

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

  // The Telegram SDK is ~18 kB gzip and is useless outside the client, so it is both
  // code-split (dynamic import) and GATED: a plain browser never downloads the chunk.
  // Inside Telegram the init still completes before the first render, so mounted
  // buttons, viewport and theme variables are ready in time. The DEV mock forces the
  // gate open so `VITE_MOCK_TELEGRAM=1 npm run dev` keeps exercising the real path.
  const telegramWebApp =
    typeof window === 'undefined'
      ? undefined
      : (window as unknown as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp;
  const needTelegram = telegramWebApp != null || import.meta.env.VITE_MOCK_TELEGRAM === '1';

  if (needTelegram) {
    const { initTelegramSDK } = await import('./platform/telegram_adapter');
    await initTelegramSDK();
  } else {
    console.log('Not in Telegram — running in browser mode (Telegram SDK not loaded)');
  }

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
