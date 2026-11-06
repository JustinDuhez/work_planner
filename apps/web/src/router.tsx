import { createBrowserRouter, type RouteObject } from 'react-router';
import { HomePage } from './home/home-page';
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
          { index: true, element: <HomePage /> },
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
