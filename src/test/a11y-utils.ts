import { axe } from 'jest-axe';

/**
 * Runs axe-core against a rendered container and fails the test when any
 * accessibility violation is reported. Colour-contrast checks are reported by
 * axe as "incomplete" under jsdom (no layout engine), so those are verified
 * separately by the WCAG contrast assertions in the theme tests.
 */
export async function testAccessibility(container: HTMLElement): Promise<void> {
  const results = await axe(container);
  expect(results).toHaveNoViolations();
}