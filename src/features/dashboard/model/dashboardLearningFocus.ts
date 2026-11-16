import { useQueries } from '@tanstack/react-query';
import type { LearningTaskResponse } from '../../learningTasks/api/learningTasksApi';
import { getLearningTasks } from '../../learningTasks/api/learningTasksApi';
import { learningTaskQueryKeys } from '../../learningTasks/model/learningTaskQueries';
import type { TopicResponse } from '../../topics/api/topicsApi';
import { useTopics } from '../../topics/model/topicQueries';

export type DashboardTask = LearningTaskResponse & { topic: TopicResponse };

export function selectNextDashboardTask(tasks: DashboardTask[]) {
  return (
    tasks.find((task) => task.status === 'IN_PROGRESS') ??
    tasks.find((task) => task.status === 'PLANNED') ??
    null
  );
}

export function useDashboardLearningFocus(userId: number) {
  const topicsQuery = useTopics(userId);
  const topics = topicsQuery.data ?? [];
  const taskQueries = useQueries({
    queries: topics.map((topic) => ({
      queryKey: learningTaskQueryKeys.list(userId, topic.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => getLearningTasks(topic.id, signal),
      staleTime: 30_000,
    })),
  });

  const tasks = topics.flatMap((topic, index) =>
    (taskQueries[index]?.data ?? []).map((task) => ({ ...task, topic })),
  );
  const nextTask = selectNextDashboardTask(tasks);
  const focusTopic = nextTask?.topic ?? topics[0] ?? null;
  const pathTasks = focusTopic
    ? tasks.filter((task) => task.topicId === focusTopic.id).slice(0, 5)
    : [];
  const taskError = taskQueries.find((query) => query.error)?.error;

  return {
    topics,
    tasks,
    nextTask,
    focusTopic,
    pathTasks,
    isPending: topicsQuery.isPending || taskQueries.some((query) => query.isPending),
    error: topicsQuery.error ?? taskError,
    refetch: async () => {
      await topicsQuery.refetch();
      await Promise.all(taskQueries.map((query) => query.refetch()));
    },
  };
}
