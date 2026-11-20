/** Matches a summary card whose text shows `value` right after `label`, whole number only. */
export function stat(label: string, value: string): RegExp {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*${value}(?!\\d)`);
}
