import { copy } from '../copy';
import { useSession } from '../session/session-queries';
import { PageLayout } from '../ui/page-layout';
import { IdentityCard } from './identity-card';
import { PasswordForm } from './password-form';
import { ProfileInfoForm } from './profile-info-form';

export function ProfilePage() {
  const { data: session } = useSession();
  if (!session) return null;
  return (
    <PageLayout
      bar={
        <h1 className="text-xl font-semibold tracking-tight text-balance">{copy.profile.title}</h1>
      }
      main={
        <div className="space-y-6">
          <ProfileInfoForm user={session.user} />
          <PasswordForm />
        </div>
      }
      aside={<IdentityCard user={session.user} />}
    />
  );
}
