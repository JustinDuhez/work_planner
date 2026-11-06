import { isSafeRedirectPath } from '@work-planner/domain';
import { Eye, EyeOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../api/api-client';
import { copy } from '../copy';
import { useLogin, useSession } from '../session/session-queries';
import { Button } from '../ui/button';
import { TextField } from '../ui/text-field';

const HOME_PATH = '/';

function returnPathFrom(searchParams: URLSearchParams): string {
  const requested = searchParams.get('retour');
  return requested !== null && isSafeRedirectPath(requested) ? requested : HOME_PATH;
}

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const session = useSession();
  const login = useLogin();
  const returnPath = returnPathFrom(searchParams);

  if (session.data) {
    return <Navigate to={returnPath} replace />;
  }

  const apiError = login.error instanceof ApiError ? login.error : undefined;
  const hasFieldErrors = apiError !== undefined && Object.keys(apiError.fieldErrors).length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login.mutate(
      { email, password },
      { onSuccess: () => void navigate(returnPath, { replace: true }) },
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4 py-10 font-sans">
      <section className="w-full max-w-sm rounded-card border border-zinc-200 bg-white p-6 shadow-card sm:p-8">
        <p className="text-sm font-semibold tracking-tight text-primary-600">{copy.appName}</p>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-zinc-900">
          {copy.login.title}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{copy.login.subtitle}</p>
        {apiError && !hasFieldErrors ? (
          <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {apiError.message}
          </p>
        ) : null}
        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          <TextField
            label={copy.login.email}
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={setEmail}
            error={apiError?.fieldErrors.email}
          />
          <TextField
            label={copy.login.password}
            name="password"
            type={isPasswordVisible ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            error={apiError?.fieldErrors.password}
            trailing={
              <button
                type="button"
                onClick={() => setIsPasswordVisible((isVisible) => !isVisible)}
                aria-label={isPasswordVisible ? copy.login.hidePassword : copy.login.showPassword}
                className="rounded-md p-2 text-zinc-500 hover:text-zinc-800"
              >
                {isPasswordVisible ? (
                  <EyeOff size={16} aria-hidden />
                ) : (
                  <Eye size={16} aria-hidden />
                )}
              </button>
            }
          />
          <Button type="submit" isPending={login.isPending}>
            {login.isPending ? copy.login.submitting : copy.login.submit}
          </Button>
        </form>
      </section>
    </main>
  );
}
