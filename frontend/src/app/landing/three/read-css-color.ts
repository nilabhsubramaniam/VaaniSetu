/**
 * Reads a CSS custom property off an element (defaulting to `:root`) so
 * Three.js materials can pick up the page's own design tokens instead of
 * hardcoding colors that would drift from `_tokens.scss` and ignore theme
 * switches.
 */
export function readCssColor(propertyName: string, fallback: string, el?: Element): string {
  const target = el ?? document.documentElement;
  const value = getComputedStyle(target).getPropertyValue(propertyName).trim();
  return value.length > 0 ? value : fallback;
}
