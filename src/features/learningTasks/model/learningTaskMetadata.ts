export const learningTaskStatuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED'] as const;
export const learningTaskDifficulties = ['EASY', 'MEDIUM', 'HARD'] as const;
export const learningTaskPriorities = ['LOW', 'MEDIUM', 'HIGH'] as const;

export type LearningTaskStatus = (typeof learningTaskStatuses)[number];
export type LearningTaskDifficulty = (typeof learningTaskDifficulties)[number];
export type LearningTaskPriority = (typeof learningTaskPriorities)[number];

export const learningTaskStatusLabels: Record<LearningTaskStatus, string> = {
  PLANNED: 'Planned',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
};

export const learningTaskDifficultyLabels: Record<LearningTaskDifficulty, string> = {
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
};

export const learningTaskPriorityLabels: Record<LearningTaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

export function isLearningTaskStatus(value: unknown): value is LearningTaskStatus {
  return learningTaskStatuses.some((status) => status === value);
}

export function isLearningTaskDifficulty(value: unknown): value is LearningTaskDifficulty {
  return learningTaskDifficulties.some((difficulty) => difficulty === value);
}

export function isLearningTaskPriority(value: unknown): value is LearningTaskPriority {
  return learningTaskPriorities.some((priority) => priority === value);
}
