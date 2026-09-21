import type { ReactNode } from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';

// HTMLMotionProps (not ComponentPropsWithoutRef<'button'>) is required: motion's
// onDrag/onAnimationStart signatures differ from the DOM ones, so spreading the
// DOM prop type into motion.button is a type error.
type MotionButtonProps = HTMLMotionProps<'button'> & {
  children: ReactNode;
};

/**
 * Button with motion micro-interactions. Only transform/opacity are animated
 * (GPU friendly, no layout shift). When the user prefers reduced motion the
 * scale feedback is skipped entirely and the button stays static.
 */
export function MotionButton({ children, onClick, style, ...rest }: MotionButtonProps) {
  const reduce = useReducedMotion();

  return (
    <motion.button
      whileTap={reduce ? {} : { scale: 0.97 }}
      whileHover={reduce ? {} : { scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      onClick={onClick}
      style={style}
      {...rest}
    >
      {children}
    </motion.button>
  );
}