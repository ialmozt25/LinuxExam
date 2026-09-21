import '@testing-library/jest-dom/vitest';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';

// NOTE: the matcher is imported from 'jest-axe' (its main entry), not from
// 'jest-axe/extend-expect'. That submodule only calls expect.extend() against a
// Jest global and exports nothing, so importing a named binding from it yields
// undefined under Vitest.
expect.extend(toHaveNoViolations);

afterEach(() => {
  cleanup();
});