# Work Planner

Application web de gestion des temps des salariés : badgeuse dématérialisée et gestion des congés.

## Stack

- **API**: Node.js 24, TypeScript, Fastify, Kysely, PostgreSQL 17
- **Web**: React 19, Vite, TanStack Query, Tailwind CSS
- **Shared**: `packages/domain` — pure business rules and zod contracts used by both sides
- **Quality**: ESLint (`eslint-config-willemse`), Prettier, Jest

## Prerequisites

- Node.js 24
- PostgreSQL 17 with a `work_planner` role owning two databases, `work_planner` and `work_planner_test`:

  ```sql
  CREATE ROLE work_planner LOGIN PASSWORD 'work_planner';
  CREATE DATABASE work_planner OWNER work_planner;
  CREATE DATABASE work_planner_test OWNER work_planner;
  ```

## Getting started

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run migrate
npm run dev:api   # API on http://127.0.0.1:3001
npm run dev:web   # app on http://localhost:5173
```

## Scripts

| Command             | What it does                                             |
| ------------------- | -------------------------------------------------------- |
| `npm test`          | Jest tests (integration tests reset `work_planner_test`) |
| `npm run lint`      | ESLint with the Willemse config                          |
| `npm run typecheck` | TypeScript in every workspace                            |
| `npm run format`    | Prettier                                                 |
| `npm run build`     | Production bundle: `apps/api/dist` + `apps/web/dist`     |

## Deployment

Render (Docker, free plan) + Neon (PostgreSQL). Render deploys `main` once the GitHub CI check passes; the container runs migrations before starting the server.
