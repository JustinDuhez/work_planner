import { useState } from 'react';
import { copy } from '../copy';
import { useSession } from '../session/session-queries';
import { Button } from '../ui/button';
import { useDirectory } from './directory-queries';
import { DirectoryPage } from './directory-page';
import { ManageUserDialog } from './manage-user-dialog';
import { NewUserDialog } from './new-user-dialog';

export function DirectoryAdminPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.roles.isAdmin ?? false;
  const [isShowingArchived, setIsShowingArchived] = useState(false);
  const [managedUserId, setManagedUserId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  // Same query key as the page: one request, shared cache.
  const directory = useDirectory(isShowingArchived);
  const managed = directory.data?.find((entry) => entry.id === managedUserId);

  return (
    <>
      <DirectoryPage
        includeArchived={isShowingArchived}
        toolbar={
          isAdmin ? (
            <>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={isShowingArchived}
                  onChange={(event) => {
                    setIsShowingArchived(event.target.checked);
                    setManagedUserId(null);
                  }}
                />
                {copy.directory.archived}
              </label>
              <Button onClick={() => setIsCreating(true)}>{copy.directory.newUser}</Button>
            </>
          ) : undefined
        }
        rowAction={(entry) =>
          entry.canManage || entry.canEditWorkingTime ? (
            <Button variant="secondary" onClick={() => setManagedUserId(entry.id)}>
              {copy.directory.manage}
            </Button>
          ) : null
        }
      />
      {managed ? (
        <ManageUserDialog key={managed.id} entry={managed} onClose={() => setManagedUserId(null)} />
      ) : null}
      {isCreating ? <NewUserDialog onClose={() => setIsCreating(false)} /> : null}
    </>
  );
}
