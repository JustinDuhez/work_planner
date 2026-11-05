import { copy } from '../copy';
import { HealthStatus } from '../health/health-status';

export function HomePage() {
  return (
    <section className="rounded-card border border-zinc-200 bg-white p-6 shadow-card">
      <h1 className="text-xl font-semibold tracking-tight">{copy.home.title}</h1>
      <p className="mt-1 text-sm text-zinc-500">{copy.home.subtitle}</p>
      <div className="mt-4">
        <HealthStatus />
      </div>
    </section>
  );
}
