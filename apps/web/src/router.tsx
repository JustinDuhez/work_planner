import { createBrowserRouter } from 'react-router';
import { HomePage } from './home/home-page';
import { NotFoundPage } from './not-found/not-found-page';
import { AppShell } from './shell/app-shell';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
