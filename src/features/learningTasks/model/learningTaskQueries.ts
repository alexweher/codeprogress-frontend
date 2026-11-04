import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RequestAbortedError } from '../../../shared/api/apiError';
import { authSession } from '../../../shared/api/authSession';
import { dashboardQueryKeys } from '../../dashboard/model/dashboardQueries';
import {
  createLearningTask,
  deleteLearningTask,
  getLearningTask,
  getLearningTasks,
  updateLearningTask,
  updateLearningTaskPlanning,
  updateLearningTaskStatus,
  type CreateLearningTaskRequest,
  type LearningTaskResponse,
  type UpdateLearningTaskPlanningRequest,
  type UpdateLearningTaskRequest,
  type UpdateLearningTaskStatusRequest,
} from '../api/learningTasksApi';

export const learningTaskQueryKeys = {
  all: (userId: number) => ['learningTasks', userId] as const,
  topic: (userId: number, topicId: number) =>
    [...learningTaskQueryKeys.all(userId), 'topic', topicId] as const,
  list: (userId: number, topicId: number) =>
    [...learningTaskQueryKeys.topic(userId, topicId), 'list'] as const,
  detail: (userId: number, taskId: number) =>
    [...learningTaskQueryKeys.all(userId), 'detail', taskId] as const,
};

export function useLearningTasks(userId: number, topicId: number) {
  return useQuery({
    queryKey: learningTaskQueryKeys.list(userId, topicId),
    queryFn: ({ signal }) => getLearningTasks(topicId, signal),
  });
}

export function useLearningTask(userId: number, taskId: number) {
  return useQuery({
    queryKey: learningTaskQueryKeys.detail(userId, taskId),
    queryFn: ({ signal }) => getLearningTask(taskId, signal),
  });
}

async function updateLearningTaskCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: number,
  task: LearningTaskResponse,
) {
  queryClient.setQueryData(learningTaskQueryKeys.detail(userId, task.id), task);
  queryClient.setQueryData<LearningTaskResponse[]>(
    learningTaskQueryKeys.list(userId, task.topicId),
    (tasks) => tasks?.map((current) => (current.id === task.id ? task : current)),
  );
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: learningTaskQueryKeys.detail(userId, task.id),
      exact: true,
      refetchType: 'none',
    }),
    queryClient.invalidateQueries({
      queryKey: learningTaskQueryKeys.list(userId, task.topicId),
      exact: true,
      refetchType: 'none',
    }),
  ]);
}

function withSessionGuard<TRequest, TResponse>(request: (value: TRequest) => Promise<TResponse>) {
  return async (value: TRequest) => {
    const sessionToken = authSession.getAccessToken();
    const response = await request(value);
    if (!sessionToken || authSession.getAccessToken() !== sessionToken) {
      throw new RequestAbortedError();
    }
    return response;
  };
}

export function useUpdateLearningTask(userId: number, taskId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionGuard<UpdateLearningTaskRequest, LearningTaskResponse>((request) =>
      updateLearningTask(taskId, request),
    ),
    onSuccess: (task) => updateLearningTaskCaches(queryClient, userId, task),
  });
}

export function useUpdateLearningTaskStatus(userId: number, taskId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionGuard<UpdateLearningTaskStatusRequest, LearningTaskResponse>((request) =>
      updateLearningTaskStatus(taskId, request),
    ),
    onSuccess: async (task) => {
      await updateLearningTaskCaches(queryClient, userId, task);
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.summary(userId),
        refetchType: 'none',
      });
    },
  });
}

export function useUpdateLearningTaskPlanning(userId: number, taskId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionGuard<UpdateLearningTaskPlanningRequest, LearningTaskResponse>(
      (request) => updateLearningTaskPlanning(taskId, request),
    ),
    onSuccess: (task) => updateLearningTaskCaches(queryClient, userId, task),
  });
}

export function useDeleteLearningTask(userId: number, taskId: number, topicId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const sessionToken = authSession.getAccessToken();
      await deleteLearningTask(taskId);

      if (!sessionToken || authSession.getAccessToken() !== sessionToken) {
        throw new RequestAbortedError();
      }
    },
    onSuccess: async () => {
      const listKey = learningTaskQueryKeys.list(userId, topicId);
      queryClient.setQueryData<LearningTaskResponse[]>(listKey, (tasks) =>
        tasks?.filter((task) => task.id !== taskId),
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: listKey, exact: true, refetchType: 'none' }),
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.summary(userId),
          refetchType: 'none',
        }),
      ]);
    },
  });
}

export function useCreateLearningTask(userId: number, topicId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateLearningTaskRequest) => {
      const sessionToken = authSession.getAccessToken();
      const task = await createLearningTask(topicId, request);

      if (!sessionToken || authSession.getAccessToken() !== sessionToken) {
        throw new RequestAbortedError();
      }

      return task;
    },
    onSuccess: async (task) => {
      const listKey = learningTaskQueryKeys.list(userId, topicId);
      queryClient.setQueryData<LearningTaskResponse[]>(listKey, (tasks) => [
        ...(tasks ?? []),
        task,
      ]);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: listKey, exact: true, refetchType: 'none' }),
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.summary(userId),
          refetchType: 'none',
        }),
      ]);
    },
  });
}
