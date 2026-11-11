import { createTeamRequestSchema, updateTeamRequestSchema } from '@work-planner/domain';
import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import { clockViewerOf } from '../clock/clock-dependencies';
import type { Database } from '../db/database';
import { databaseIdSchema } from '../http/database-id';
import { parseInput } from '../http/parse-input';
import { createTeam, deleteTeam, updateTeam } from './team-commands';
import { loadTeams } from './teams';

const teamParamsSchema = z.object({ id: databaseIdSchema('Équipe invalide.') });

export function registerTeamRoutes(scope: FastifyInstance, deps: { db: Kysely<Database> }): void {
  scope.get('/api/v1/teams', (request) => loadTeams(deps.db, clockViewerOf(request, deps.db)));

  scope.post('/api/v1/teams', async (request, reply) => {
    const body = parseInput(createTeamRequestSchema, request.body);
    const team = await createTeam(deps.db, { viewer: clockViewerOf(request, deps.db), ...body });
    return reply.status(201).send(team);
  });

  scope.patch('/api/v1/teams/:id', (request) => {
    const { id } = parseInput(teamParamsSchema, request.params);
    const body = parseInput(updateTeamRequestSchema, request.body);
    return updateTeam(deps.db, { viewer: clockViewerOf(request, deps.db), teamId: id, ...body });
  });

  scope.delete('/api/v1/teams/:id', async (request, reply) => {
    const { id } = parseInput(teamParamsSchema, request.params);
    await deleteTeam(deps.db, { viewer: clockViewerOf(request, deps.db), teamId: id });
    return reply.status(204).send();
  });
}
