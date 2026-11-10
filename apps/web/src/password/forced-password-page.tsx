import { useQueryClient } from '@tanstack/react-query';
import { isSafeRedirectPath } from '@work-planner/domain';
import { useNavigate, useSearchParams } from 'react-router';
import { copy } from '../copy';
import { Button } from '../ui/button';
import { PasswordForm } from '../profile/password-form';
import { SESSION_QUERY_KEY, useLogout } from '../session/session-queries';

const HOME_PATH = '/';

export function ForcedPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = useLogout();

  async function handleChanged() {
    // The session no longer requires a change: refetch it before leaving, or the guard would bounce back.
    await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    const requested = searchParams.get('retour');
    void navigate(requested !== null && isSafeRedirectPath(requested) ? requested : HOME_PATH, {
      replace: true,
    });
  }

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight">{copy.forcedPassword.title}</h1>
      <p className="text-sm text-zinc-600">{copy.forcedPassword.intro}</p>
      <PasswordForm onSuccess={() => void handleChanged()} />
      <Button
        variant="secondary"
        onClick={() =>
          logout.mutate(undefined, {
            onSettled: () => void navigate('/connexion', { replace: true }),
          })
        }
      >
        {copy.userMenu.logout}
      </Button>
    </main>
  );
}
