import { axe } from 'jest-axe';

// jsdom cannot compute colors: contrast is guaranteed by the design tokens instead (E8b §3).
const AXE_OPTIONS = { rules: { 'color-contrast': { enabled: false } } };

export async function expectNoAxeViolations(container: Element): Promise<void> {
  expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
}
