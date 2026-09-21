import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionButton } from '../MotionButton';

const useReducedMotionMock = vi.hoisted(() => vi.fn<() => boolean>());

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();
  return { ...actual, useReducedMotion: useReducedMotionMock };
});

describe('MotionButton', () => {
  beforeEach(() => {
    useReducedMotionMock.mockReturnValue(false);
  });

  it('renders children', () => {
    render(<MotionButton>Нажми</MotionButton>);

    expect(screen.getByRole('button', { name: 'Нажми' })).toBeInTheDocument();
  });

  it('fires onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<MotionButton onClick={onClick}>Клик</MotionButton>);

    await userEvent.click(screen.getByRole('button', { name: 'Клик' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not register scale feedback when reduced motion is preferred', () => {
    useReducedMotionMock.mockReturnValue(true);

    render(<MotionButton>Тихо</MotionButton>);

    expect(useReducedMotionMock).toHaveBeenCalled();
    const button = screen.getByRole('button', { name: 'Тихо' });
    // whileTap/whileHover are empty objects under reduced motion, so nothing animates
    // at rest and no transform is applied to the element.
    expect(button.style.transform).toBe('');
  });

  it('keeps click behaviour unchanged under reduced motion', async () => {
    useReducedMotionMock.mockReturnValue(true);
    const onClick = vi.fn();
    render(<MotionButton onClick={onClick}>Тихо-клик</MotionButton>);

    await userEvent.click(screen.getByRole('button', { name: 'Тихо-клик' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});