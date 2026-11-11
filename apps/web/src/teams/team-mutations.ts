import { useMutation, useQueryClient } from '@tanstack/react-query';
import { teamSchema, type CreateTeamRequest, type UpdateTeamRequest } from '@work-planner/domain';
import { apiSend, apiSendNoContent } from '../api/api-client';
import { DIRECTORY_QUERY_KEY } from '../directory/directory-queries';
import { SESSION_QUERY_KEY } from '../session/session-queries';
import { TEAMS_QUERY_KEY } from './team-queries';

function useInvalidateTeams() {
  const queryClient = useQueryClient();
  // Teams shape the directory's team and manager columns and the session's roles.
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: DIRECTORY_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }),
    ]);
}

export function useCreateTeam() {
  const invalidate = useInvalidateTeams();
  return useMutation({
    mutationFn: (body: CreateTeamRequest) => apiSend('POST', '/api/v1/teams', body, teamSchema),
    onSuccess: invalidate,
  });
}

export function useUpdateTeam(teamId: number) {
  const invalidate = useInvalidateTeams();
  return useMutation({
    mutationFn: (body: UpdateTeamRequest) =>
      apiSend('PATCH', `/api/v1/teams/${teamId}`, body, teamSchema),
    onSuccess: invalidate,
  });
}

export function useDeleteTeam(teamId: number) {
  const invalidate = useInvalidateTeams();
  return useMutation({
    mutationFn: () => apiSendNoContent('DELETE', `/api/v1/teams/${teamId}`),
    onSuccess: invalidate,
  });
}
