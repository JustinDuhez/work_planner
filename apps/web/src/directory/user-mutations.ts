import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  directoryEntrySchema,
  type CreateUserRequest,
  type UpdateUserRequest,
  type UpdateWorkingTimeRequest,
} from '@work-planner/domain';
import { apiSend, apiSendNoContent } from '../api/api-client';
import { SESSION_QUERY_KEY } from '../session/session-queries';
import { DIRECTORY_QUERY_KEY } from './directory-queries';

function useInvalidatePeople() {
  const queryClient = useQueryClient();
  // The directory, the E3 person picker and, when admins edit themselves, the session.
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: DIRECTORY_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ['users'] }),
      queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }),
    ]);
}

export function useCreateUser() {
  const invalidate = useInvalidatePeople();
  return useMutation({
    mutationFn: (body: CreateUserRequest) =>
      apiSend('POST', '/api/v1/users', body, directoryEntrySchema),
    onSuccess: invalidate,
  });
}

export function useUpdateUser(userId: number) {
  const invalidate = useInvalidatePeople();
  return useMutation({
    mutationFn: (body: UpdateUserRequest) =>
      apiSend('PATCH', `/api/v1/users/${userId}`, body, directoryEntrySchema),
    onSuccess: invalidate,
  });
}

export function useResetPassword(userId: number) {
  return useMutation({
    mutationFn: (newPassword: string) =>
      apiSendNoContent('PUT', `/api/v1/users/${userId}/password`, { newPassword }),
  });
}

export function useUpdateWorkingTime(userId: number) {
  const invalidate = useInvalidatePeople();
  return useMutation({
    mutationFn: (body: UpdateWorkingTimeRequest) =>
      apiSend('PATCH', `/api/v1/users/${userId}/working-time`, body, directoryEntrySchema),
    onSuccess: invalidate,
  });
}
