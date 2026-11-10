import { Navigate, Outlet, useLocation } from 'react-router';
import { copy } from '../copy';
import { useSession } from './session-queries';

const FORCED_PASSWORD_PATH = '/mot-de-passe';

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
  if (session.data.user.mustChangePassword && location.pathname !== FORCED_PASSWORD_PATH) {
    const returnPath = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`${FORCED_PASSWORD_PATH}?retour=${returnPath}`} replace />;
  }
  return <Outlet />;
}
