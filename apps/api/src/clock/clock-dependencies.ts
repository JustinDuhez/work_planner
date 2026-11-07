import type { Actor } from '@work-planner/domain';
import type { FastifyRequest } from 'fastify';
import type { Kysely } from 'kysely';
import { requireSession } from '../auth/auth-plugin';
import type { Database } from '../db/database';
import { getActor } from '../organization/request-actor';

export interface ClockDependencies {
  db: Kysely<Database>;
  now: () => Date;
  timeZone: string;
}

/** The person making the request; their policy actor is loaded only if a rule needs it. */
export interface ClockViewer {
  id: number;
  loadActor: () => Promise<Actor>;
}

export function clockViewerOf(request: FastifyRequest, db: Kysely<Database>): ClockViewer {
  return { id: requireSession(request).user.id, loadActor: () => getActor(request, db) };
}
