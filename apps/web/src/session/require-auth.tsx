import { Navigate, Outlet, useLocation } from 'react-router';
import { copy } from '../copy';
import { useSession } from './session-queries';

export function RequireAuth() {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) {
    return <p className="p-6 text-sm text-zinc-500">{copy.session.loading}</p>;
  }
  if (session.isError) {
    return (
      <p role="alert" className="p-6 text-sm text-rose-700">
        {copy.session.loadError}
      </p>
    );
  }
  if (!session.data) {
    const returnPath = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/connexion?retour=${returnPath}`} replace />;
  }
  return <Outlet />;
}
