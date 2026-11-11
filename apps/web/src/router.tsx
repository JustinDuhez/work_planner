import { createBrowserRouter, type RouteObject } from 'react-router';
import { ClockWeekPage } from './clock/clock-week-page';
import { DirectoryAdminPage } from './directory/directory-admin-page';
import { LoginPage } from './login/login-page';
import { NotFoundPage } from './not-found/not-found-page';
import { ForcedPasswordPage } from './password/forced-password-page';
import { ProfilePage } from './profile/profile-page';
import { RequireAuth } from './session/require-auth';
import { SettingsPage } from './settings/settings-page';
import { AppShell } from './shell/app-shell';
import { TeamsAdminPage } from './teams/teams-admin-page';

export const routes: RouteObject[] = [
  { path: '/connexion', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/mot-de-passe', element: <ForcedPasswordPage /> },
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <ClockWeekPage /> },
          { path: 'pointage/:userId', element: <ClockWeekPage /> },
          { path: 'annuaire', element: <DirectoryAdminPage /> },
          { path: 'profil', element: <ProfilePage /> },
          { path: 'equipes', element: <TeamsAdminPage /> },
          { path: 'parametres', element: <SettingsPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
