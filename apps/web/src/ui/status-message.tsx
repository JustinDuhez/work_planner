/** Always mounted: a live region inserted already filled is often not announced (E8b §4). */
export function StatusMessage({ message }: { message: string | null }) {
  return (
    <p role="status" className="min-h-5 text-sm text-zinc-600">
      {message ? (
        <span className="motion-safe:animate-[week-in_200ms_ease-out]">{message}</span>
      ) : null}
    </p>
  );
}
