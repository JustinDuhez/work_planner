import { createBrowserRouter, type RouteObject } from 'react-router';
import { copy } from './copy';
import { HomePage } from './home/home-page';
import { LoginPage } from './login/login-page';
import { NotFoundPage } from './not-found/not-found-page';
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
          // Replaced by the real profile page in the next task.
          { path: 'profil', element: <h1>{copy.profile.title}</h1> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
