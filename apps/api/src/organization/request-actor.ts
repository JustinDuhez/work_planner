import type { Actor } from '@work-planner/domain';
import type { FastifyRequest } from 'fastify';
import type { Kysely } from 'kysely';
import { requireSession } from '../auth/auth-plugin';
import type { Database } from '../db/database';
import { loadActor } from './actor';

// The actor costs three queries: build it at most once per request, on demand.
const actorByRequest = new WeakMap<FastifyRequest, Promise<Actor>>();

export function getActor(request: FastifyRequest, db: Kysely<Database>): Promise<Actor> {
  let actor = actorByRequest.get(request);
  if (!actor) {
    try {
      actor = loadActor(db, requireSession(request).user);
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
    actorByRequest.set(request, actor);
  }
  return actor;
}
