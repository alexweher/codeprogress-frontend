import type {
  LearningTaskDifficulty,
  LearningTaskPriority,
  LearningTaskStatus,
} from '../../features/learningTasks/model/learningTaskMetadata';
import type { TopicStatus } from '../../features/topics/api/topicsApi';
import type { I18nContextValue } from './I18nContext';

const statusKeys = {
  PLANNED: 'enum.planned',
  IN_PROGRESS: 'enum.inProgress',
  COMPLETED: 'enum.completed',
} as const;
const difficultyKeys = { EASY: 'enum.easy', MEDIUM: 'enum.medium', HARD: 'enum.hard' } as const;
const priorityKeys = { LOW: 'enum.low', MEDIUM: 'enum.medium', HIGH: 'enum.high' } as const;

export const localizeTopicStatus = (t: I18nContextValue['t'], value: TopicStatus) =>
  t(statusKeys[value]);
export const localizeTaskStatus = (t: I18nContextValue['t'], value: LearningTaskStatus) =>
  t(statusKeys[value]);
export const localizeDifficulty = (t: I18nContextValue['t'], value: LearningTaskDifficulty) =>
  t(difficultyKeys[value]);
export const localizePriority = (t: I18nContextValue['t'], value: LearningTaskPriority) =>
  t(priorityKeys[value]);
