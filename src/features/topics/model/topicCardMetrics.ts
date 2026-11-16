import { useQueries } from '@tanstack/react-query';
import { getLearningTasks } from '../../learningTasks/api/learningTasksApi';
import { learningTaskQueryKeys } from '../../learningTasks/model/learningTaskQueries';
import { getStudySessions } from '../../studySessions/api/studySessionsApi';
import { studySessionQueryKeys } from '../../studySessions/model/studySessionQueries';
import type { TopicResponse } from '../api/topicsApi';

export const TOPIC_CARD_METRICS_LIMIT = 4;

export type TopicCardMetric = {
  completedTasks: number;
  totalTasks: number;
  studyMinutes: number;
  sessions: number;
  isPending: boolean;
  isError: boolean;
};

export function useTopicCardMetrics(userId: number, topics: TopicResponse[], enabled: boolean) {
  const visibleTopics = topics.slice(0, TOPIC_CARD_METRICS_LIMIT);
  const taskQueries = useQueries({
    queries: visibleTopics.map((topic) => ({
      queryKey: learningTaskQueryKeys.list(userId, topic.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => getLearningTasks(topic.id, signal),
      enabled,
    })),
  });
  const sessionQueries = useQueries({
    queries: visibleTopics.map((topic) => ({
      queryKey: studySessionQueryKeys.list(userId, topic.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => getStudySessions(topic.id, signal),
      enabled,
    })),
  });

  return new Map<number, TopicCardMetric>(
    visibleTopics.map((topic, index) => {
      const tasks = taskQueries[index];
      const sessions = sessionQueries[index];
      return [
        topic.id,
        {
          completedTasks: tasks?.data?.filter((task) => task.status === 'COMPLETED').length ?? 0,
          totalTasks: tasks?.data?.length ?? 0,
          studyMinutes:
            sessions?.data?.reduce((total, session) => total + session.durationMinutes, 0) ?? 0,
          sessions: sessions?.data?.length ?? 0,
          isPending: !enabled || tasks?.isPending === true || sessions?.isPending === true,
          isError: tasks?.isError === true || sessions?.isError === true,
        },
      ];
    }),
  );
}
