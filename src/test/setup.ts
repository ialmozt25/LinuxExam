import '@testing-library/jest-dom/vitest';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';
import 'jest-axe/extend-expect';

// The named binding is imported from 'jest-axe' (its main entry): the
// 'jest-axe/extend-expect' submodule only calls expect.extend() against a global
// expect and exports nothing, so a named import from it would be undefined.
// Loading it for its side effect still registers the matcher with Vitest's
// global expect (globals: true); expect.extend(toHaveNoViolations) below does
// the same explicitly, and both registrations coexist.
expect.extend(toHaveNoViolations);

afterEach(() => {
  cleanup();
});