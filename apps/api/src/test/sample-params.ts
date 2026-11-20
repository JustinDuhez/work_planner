const SAMPLE_PARAMS: Record<string, string> = {
  id: '1',
  userId: '1',
  isoWeek: '2026-W45',
  date: '2026-11-06',
};

/** Fills the `:param` segments of a registered route URL with valid sample values. */
export function withSampleParams(url: string): string {
  return url.replace(/:(\w+)/g, (_match, name: string) => SAMPLE_PARAMS[name] ?? '1');
}
