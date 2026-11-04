import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardQueryKeys } from '../../dashboard/model/dashboardQueries';
import type { QueryClient } from '@tanstack/react-query';
import { RequestAbortedError } from '../../../shared/api/apiError';
import { authSession } from '../../../shared/api/authSession';
import {
  createTopic,
  deleteTopic,
  getTopic,
  getTopics,
  updateTopic,
  updateTopicStatus,
  type TopicResponse,
  type UpdateTopicRequest,
  type UpdateTopicStatusRequest,
} from '../api/topicsApi';

export const topicQueryKeys = {
  all: (userId: number) => ['topics', userId] as const,
  list: (userId: number) => [...topicQueryKeys.all(userId), 'list'] as const,
  detail: (userId: number, topicId: number) =>
    [...topicQueryKeys.all(userId), 'detail', topicId] as const,
};

function withSessionGuard<TArguments extends unknown[], TResponse>(
  request: (...arguments_: TArguments) => Promise<TResponse>,
) {
  return async (...arguments_: TArguments) => {
    const sessionToken = authSession.getAccessToken();
    const response = await request(...arguments_);

    if (!sessionToken || authSession.getAccessToken() !== sessionToken) {
      throw new RequestAbortedError();
    }

    return response;
  };
}

export function useTopics(userId: number) {
  return useQuery({
    queryKey: topicQueryKeys.list(userId),
    queryFn: ({ signal }) => getTopics(signal),
  });
}

export function useCreateTopic(userId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withSessionGuard(createTopic),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: topicQueryKeys.all(userId) }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.summary(userId) }),
      ]);
    },
  });
}

export function useTopic(userId: number, topicId: number) {
  return useQuery({
    queryKey: topicQueryKeys.detail(userId, topicId),
    queryFn: ({ signal }) => getTopic(topicId, signal),
  });
}

async function updateTopicCaches(queryClient: QueryClient, userId: number, topic: TopicResponse) {
  queryClient.setQueryData(topicQueryKeys.detail(userId, topic.id), topic);
  queryClient.setQueryData<TopicResponse[]>(topicQueryKeys.list(userId), (topics) =>
    topics?.map((current) => (current.id === topic.id ? topic : current)),
  );

  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: topicQueryKeys.detail(userId, topic.id),
      refetchType: 'none',
    }),
    queryClient.invalidateQueries({
      queryKey: topicQueryKeys.list(userId),
      refetchType: 'none',
    }),
  ]);
}

export function useUpdateTopic(userId: number, topicId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withSessionGuard<[UpdateTopicRequest], TopicResponse>((request) =>
      updateTopic(topicId, request),
    ),
    onSuccess: (topic) => updateTopicCaches(queryClient, userId, topic),
  });
}

export function useUpdateTopicStatus(userId: number, topicId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withSessionGuard<[UpdateTopicStatusRequest], TopicResponse>((request) =>
      updateTopicStatus(topicId, request),
    ),
    onSuccess: (topic) => updateTopicCaches(queryClient, userId, topic),
  });
}

export function useDeleteTopic(userId: number, topicId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const sessionToken = authSession.getAccessToken();
      await deleteTopic(topicId);

      if (!sessionToken || authSession.getAccessToken() !== sessionToken) {
        throw new RequestAbortedError();
      }
    },
    onSuccess: async () => {
      const detailKey = topicQueryKeys.detail(userId, topicId);
      queryClient.removeQueries({ queryKey: detailKey, exact: true });
      queryClient.setQueryData<TopicResponse[]>(topicQueryKeys.list(userId), (topics) =>
        topics?.filter((topic) => topic.id !== topicId),
      );

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: topicQueryKeys.list(userId),
          refetchType: 'none',
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.summary(userId),
          refetchType: 'none',
        }),
      ]);
    },
  });
}
