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

## Demo data

`npm run seed` creates the admin account (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) and a fictional company. It can run any number of times: existing people, teams and passwords are never changed. It also adds three weeks of clock history (Léa has one unclosed day; Hugo is clocked in today when the seed runs after 9:00).

| Account                                                                      | Role                                                   |
| ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| claire.martin@example.com                                                    | Manager, Direction (top of the hierarchy)              |
| julien.bernard@example.com                                                   | Manager, Tech (inside Direction, above Front and Back) |
| sophie.dubois@example.com / thomas.petit@example.com                         | Managers, Front / Back                                 |
| lea.moreau@example.com, camille.simon@example.com, emma.lefebvre@example.com | Collaborators                                          |
| hugo.laurent@example.com                                                     | Collaborator in two teams (Front and Back)             |
| ines.garcia@example.com                                                      | HR collaborator with the administrator option          |
| lucas.fournier@example.com                                                   | Blocked account                                        |
| chloe.girard@example.com                                                     | Archived account (cannot log in, hidden everywhere)    |

All demo accounts share the password set in `DEMO_PASSWORD`. Because one of them is an administrator, that password is **not** published here; it is shared privately along with the admin credentials.

To seed the production database (Neon), run from your machine. The shell must provide all three seed variables (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEMO_PASSWORD`) with real values (never a `change-this-...` placeholder). When `DATABASE_URL` is set in the shell, `apps/api/.env` is not read at all:

```bash
cd apps/api
set -a && . ../../.env.local && set +a   # Neon DATABASE_URL / DATABASE_URL_UNPOOLED
ADMIN_EMAIL=... ADMIN_PASSWORD=... DEMO_PASSWORD=... npx tsx src/seed.ts
```

## Scripts

| Command             | What it does                                             |
| ------------------- | -------------------------------------------------------- |
| `npm run seed`      | Idempotent admin + demo company                          |
| `npm test`          | Jest tests (integration tests reset `work_planner_test`) |
| `npm run lint`      | ESLint with the Willemse config                          |
| `npm run typecheck` | TypeScript in every workspace                            |
| `npm run format`    | Prettier                                                 |
| `npm run build`     | Production bundle: `apps/api/dist` + `apps/web/dist`     |

## Deployment

Render (Docker, free plan) + Neon (PostgreSQL, `eu-central-1`). Render deploys `main` once the GitHub CI check passes; the container runs migrations before starting the server.

The Neon project is linked with `neon init` (`neon.ts` declares the services; `.neon` and the pulled `.env.local` stay local). On Render, set:

- `DATABASE_URL`: Neon's **pooled** connection string (`-pooler` host), used by the app.
- `DATABASE_URL_UNPOOLED`: Neon's **direct** connection string, used by migrations (PgBouncer's transaction mode does not support session-level operations).
