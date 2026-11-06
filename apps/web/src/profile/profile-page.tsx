import { copy } from '../copy';
import { useSession } from '../session/session-queries';
import { PasswordForm } from './password-form';
import { ProfileInfoForm } from './profile-info-form';

export function ProfilePage() {
  const { data: session } = useSession();
  if (!session) return null;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">{copy.profile.title}</h1>
      <ProfileInfoForm user={session.user} />
      <PasswordForm />
    </div>
  );
}
