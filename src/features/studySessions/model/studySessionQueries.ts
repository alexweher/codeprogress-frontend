import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RequestAbortedError } from '../../../shared/api/apiError';
import { authSession } from '../../../shared/api/authSession';
import { dashboardQueryKeys } from '../../dashboard/model/dashboardQueries';
import { learningTaskQueryKeys } from '../../learningTasks/model/learningTaskQueries';
import {
  createStudySession,
  deleteStudySession,
  getStudySession,
  getStudySessions,
  updateStudySession,
  type CreateStudySessionRequest,
  type StudySessionResponse,
  type UpdateStudySessionRequest,
} from '../api/studySessionsApi';

export const studySessionQueryKeys = {
  all: (userId: number) => ['studySessions', userId] as const,
  topic: (userId: number, topicId: number) =>
    [...studySessionQueryKeys.all(userId), 'topic', topicId] as const,
  list: (userId: number, topicId: number) =>
    [...studySessionQueryKeys.topic(userId, topicId), 'list'] as const,
  detail: (userId: number, sessionId: number) =>
    [...studySessionQueryKeys.all(userId), 'detail', sessionId] as const,
};

export function useStudySessions(userId: number, topicId: number) {
  return useQuery({
    queryKey: studySessionQueryKeys.list(userId, topicId),
    queryFn: ({ signal }) => getStudySessions(topicId, signal),
  });
}

export function useStudySession(userId: number, sessionId: number) {
  return useQuery({
    queryKey: studySessionQueryKeys.detail(userId, sessionId),
    queryFn: ({ signal }) => getStudySession(sessionId, signal),
  });
}

function setSessionInList(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: number,
  session: StudySessionResponse,
) {
  queryClient.setQueryData<StudySessionResponse[]>(
    studySessionQueryKeys.list(userId, session.topicId),
    (sessions) => sessions?.map((current) => (current.id === session.id ? session : current)),
  );
}

export function useUpdateStudySession(
  userId: number,
  sessionId: number,
  previousCompletedTaskIds: number[],
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UpdateStudySessionRequest) => {
      const sessionToken = authSession.getAccessToken();
      const session = await updateStudySession(sessionId, request);

      if (!sessionToken || authSession.getAccessToken() !== sessionToken) {
        throw new RequestAbortedError();
      }

      return session;
    },
    onSuccess: async (session) => {
      const affectedTaskIds = new Set([...previousCompletedTaskIds, ...session.completedTaskIds]);
      queryClient.setQueryData(studySessionQueryKeys.detail(userId, sessionId), session);
      setSessionInList(queryClient, userId, session);

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: studySessionQueryKeys.list(userId, session.topicId),
          exact: true,
          refetchType: 'none',
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.summary(userId),
          exact: true,
          refetchType: 'none',
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.activities(userId),
          refetchType: 'none',
        }),
        queryClient.invalidateQueries({
          queryKey: learningTaskQueryKeys.list(userId, session.topicId),
          exact: true,
        }),
        ...Array.from(affectedTaskIds, (taskId) =>
          queryClient.invalidateQueries({
            queryKey: learningTaskQueryKeys.detail(userId, taskId),
            exact: true,
            refetchType: 'none',
          }),
        ),
      ]);
    },
  });
}

export function useDeleteStudySession(
  userId: number,
  sessionId: number,
  topicId: number,
  completedTaskIds: number[],
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const sessionToken = authSession.getAccessToken();
      await deleteStudySession(sessionId);

      if (!sessionToken || authSession.getAccessToken() !== sessionToken) {
        throw new RequestAbortedError();
      }
    },
    onSuccess: async () => {
      const listKey = studySessionQueryKeys.list(userId, topicId);
      queryClient.setQueryData<StudySessionResponse[]>(listKey, (sessions) =>
        sessions?.filter((session) => session.id !== sessionId),
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: listKey, exact: true, refetchType: 'none' }),
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.summary(userId),
          exact: true,
          refetchType: 'none',
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.activities(userId),
          refetchType: 'none',
        }),
        queryClient.invalidateQueries({
          queryKey: learningTaskQueryKeys.list(userId, topicId),
          exact: true,
          refetchType: 'none',
        }),
        ...completedTaskIds.map((taskId) =>
          queryClient.invalidateQueries({
            queryKey: learningTaskQueryKeys.detail(userId, taskId),
            exact: true,
            refetchType: 'none',
          }),
        ),
      ]);
    },
  });
}

export function useCreateStudySession(userId: number, topicId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateStudySessionRequest) => {
      const sessionToken = authSession.getAccessToken();
      const session = await createStudySession(topicId, request);

      if (!sessionToken || authSession.getAccessToken() !== sessionToken) {
        throw new RequestAbortedError();
      }

      return session;
    },
    onSuccess: async (session) => {
      const completedTaskInvalidations = session.completedTaskIds.map((taskId) =>
        queryClient.invalidateQueries({
          queryKey: learningTaskQueryKeys.detail(userId, taskId),
          exact: true,
          refetchType: 'none',
        }),
      );

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: studySessionQueryKeys.list(userId, topicId),
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.summary(userId),
          exact: true,
          refetchType: 'none',
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.activities(userId),
          refetchType: 'none',
        }),
        ...(session.completedTaskIds.length > 0
          ? [
              queryClient.invalidateQueries({
                queryKey: learningTaskQueryKeys.list(userId, topicId),
                exact: true,
              }),
            ]
          : []),
        ...completedTaskInvalidations,
      ]);
    },
  });
}
