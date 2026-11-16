const TONE_CLASS = { neutral: 'text-zinc-600', success: 'text-emerald-700' } as const;

/** Always mounted: a live region inserted already filled is often not announced (E8b §4). */
export function StatusMessage({
  message,
  tone = 'neutral',
}: {
  message: string | null;
  tone?: keyof typeof TONE_CLASS;
}) {
  return (
    <p role="status" className={`min-h-5 text-sm ${TONE_CLASS[tone]}`}>
      {message ? (
        <span className="motion-safe:animate-[week-in_200ms_ease-out]">{message}</span>
      ) : null}
    </p>
  );
}
