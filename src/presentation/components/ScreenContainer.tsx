import type { CSSProperties, ReactNode } from 'react';
import { isTMA } from '@telegram-apps/sdk-react';

interface Props {
  children: ReactNode;
  style?: CSSProperties;
  /** Opaque test hook: forwarded to the root element so E2E can anchor a screen. */
  'data-testid'?: string;
}

export function ScreenContainer({ children, style, 'data-testid': dataTestId }: Props) {
  const isTelegram = isTMA();
  const bottomPadding = isTelegram
    ? 'calc(var(--mainbutton-height) + var(--mainbutton-gap))'
    : 'var(--space-4)';

  return (
    <div
      data-testid={dataTestId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        width: '100%',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        paddingTop: 'calc(var(--space-4) + var(--safe-top))',
        paddingBottom: `calc(${bottomPadding} + var(--safe-bottom))`,
        paddingLeft: 'calc(var(--space-4) + var(--safe-left))',
        paddingRight: 'calc(var(--space-4) + var(--safe-right))',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
