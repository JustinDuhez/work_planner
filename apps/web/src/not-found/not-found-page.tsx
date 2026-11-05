import { Link } from 'react-router';
import { copy } from '../copy';

export function NotFoundPage() {
  return (
    <section className="rounded-card border border-zinc-200 bg-white p-6 shadow-card">
      <h1 className="text-xl font-semibold tracking-tight">{copy.notFound.title}</h1>
      <p className="mt-1 text-sm text-zinc-500">{copy.notFound.description}</p>
      <Link
        to="/"
        className="mt-4 inline-block text-sm font-medium text-primary-600 hover:text-primary-700"
      >
        {copy.notFound.backHome}
      </Link>
    </section>
  );
}
