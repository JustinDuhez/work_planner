export function ErrorBanner({ message }: { message: string | undefined }) {
  return message === undefined ? null : (
    <p role="alert" className="rounded-control bg-rose-50 px-3 py-2 text-sm text-rose-800">
      {message}
    </p>
  );
}
