import { createBrowserRouter, type RouteObject } from 'react-router';
import { ClockWeekPage } from './clock/clock-week-page';
import { DirectoryAdminPage } from './directory/directory-admin-page';
import { LoginPage } from './login/login-page';
import { NotFoundPage } from './not-found/not-found-page';
import { ProfilePage } from './profile/profile-page';
import { RequireAuth } from './session/require-auth';
import { AppShell } from './shell/app-shell';

export const routes: RouteObject[] = [
  { path: '/connexion', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <ClockWeekPage /> },
          { path: 'pointage/:userId', element: <ClockWeekPage /> },
          { path: 'annuaire', element: <DirectoryAdminPage /> },
          { path: 'profil', element: <ProfilePage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
