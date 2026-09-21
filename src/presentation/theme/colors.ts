export const COLORS = {
  background: '#1E1E1E',
  surface: '#2D2D2D',
  surfaceHover: '#3A3A3A',
  textPrimary: '#FFFFFF',
  textSecondary: '#B0B0B0',
  correct: '#4CAF50',
  wrong: '#F44336',
  primary: '#2196F3',
  border: '#3A3A3A',
} as const;

/**
 * Telegram-aware aliases of COLORS. Each value falls back to the static palette
 * when the Mini App host does not publish the corresponding --tg-theme-* variable
 * (plain browser, older client, or before useTelegramTheme() has run).
 */
export const CSS_VARS = {
  background: 'var(--tg-theme-bg-color, #1E1E1E)',
  surface: 'var(--tg-theme-secondary-bg-color, #2D2D2D)',
  textPrimary: 'var(--tg-theme-text-color, #FFFFFF)',
  textSecondary: 'var(--tg-theme-hint-color, #B0B0B0)',
  primary: 'var(--tg-theme-button-color, #2196F3)',
  correct: '#4CAF50',
  wrong: '#F44336',
} as const;