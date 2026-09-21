import type { ReactNode } from 'react';
import { ChevronLeft, Home } from 'lucide-react';

interface Props {
  onBack?: () => void;
  onHome?: () => void;
  center?: ReactNode;
  right?: ReactNode;
}

const SIDE = 44;

/**
 * Shared three-slot header: back on the left, centered label, home on the right.
 * Every interactive slot is at least 44x44 (touch target minimum); when a slot
 * has no control it still renders an empty box of the same width so the center
 * label stays optically centered.
 */
export function AppHeader({ onBack, onHome, center, right }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-3) 0',
        marginBottom: 'var(--space-3)',
      }}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Назад"
          style={{
            minWidth: SIDE,
            minHeight: SIDE,
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            color: 'var(--text-secondary)',
          }}
        >
          <ChevronLeft size={20} color="var(--text-secondary)" aria-hidden="true" />
        </button>
      ) : (
        <div style={{ minWidth: SIDE, minHeight: SIDE }} aria-hidden="true" />
      )}

      <div
        style={{
          flex: 1,
          textAlign: 'center',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)',
        }}
      >
        {center}
      </div>

      {right !== undefined ? (
        right
      ) : onHome ? (
        <button
          type="button"
          onClick={onHome}
          aria-label="На главную"
          style={{
            minWidth: SIDE,
            minHeight: SIDE,
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            color: 'var(--text-secondary)',
          }}
        >
          <Home size={20} color="var(--text-secondary)" aria-hidden="true" />
        </button>
      ) : (
        <div style={{ minWidth: SIDE, minHeight: SIDE }} aria-hidden="true" />
      )}
    </div>
  );
}
