import type { TopicStatus } from '../api/topicsApi';

export const topicStatusLabels: Record<TopicStatus, string> = {
  PLANNED: 'Planned',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
};

export const topicStatuses = Object.keys(topicStatusLabels) as TopicStatus[];
