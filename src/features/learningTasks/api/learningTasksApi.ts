import { apiClient } from '../../../shared/api/apiClient';
import { ResponseFormatError } from '../../../shared/api/apiError';
import { isLocalDate } from '../lib/localDate';
import {
  isLearningTaskDifficulty,
  isLearningTaskPriority,
  isLearningTaskStatus,
  type LearningTaskDifficulty,
  type LearningTaskPriority,
  type LearningTaskStatus,
} from '../model/learningTaskMetadata';

export const LEARNING_TASK_TITLE_MAX_LENGTH = 160;
export const LEARNING_TASK_DESCRIPTION_MAX_LENGTH = 3000;

export type CreateLearningTaskRequest = {
  title: string;
  description?: string | null;
  difficulty: LearningTaskDifficulty;
  deadline?: string | null;
  priority?: LearningTaskPriority | null;
};

export type LearningTaskResponse = {
  id: number;
  topicId: number;
  title: string;
  description: string | null;
  difficulty: LearningTaskDifficulty;
  status: LearningTaskStatus;
  deadline: string | null;
  priority: LearningTaskPriority;
  createdAt: string;
  updatedAt: string;
};

export type UpdateLearningTaskRequest = {
  title: string;
  description?: string | null;
  difficulty: LearningTaskDifficulty;
};

export type UpdateLearningTaskStatusRequest = {
  status: LearningTaskStatus;
};

export type UpdateLearningTaskPlanningRequest = {
  deadline: string | null;
  priority: LearningTaskPriority;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function isLearningTaskResponse(
  value: unknown,
  topicId?: number,
): value is LearningTaskResponse {
  return (
    isRecord(value) &&
    isPositiveSafeInteger(value.id) &&
    isPositiveSafeInteger(value.topicId) &&
    (topicId === undefined || value.topicId === topicId) &&
    typeof value.title === 'string' &&
    (value.description === null || typeof value.description === 'string') &&
    isLearningTaskDifficulty(value.difficulty) &&
    isLearningTaskStatus(value.status) &&
    (value.deadline === null || isLocalDate(value.deadline)) &&
    isLearningTaskPriority(value.priority) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function validateTaskResponse(response: unknown, message: string): LearningTaskResponse {
  if (!isLearningTaskResponse(response)) {
    throw new ResponseFormatError(message);
  }
  return response;
}

export async function getLearningTasks(topicId: number, signal?: AbortSignal) {
  const response: unknown = await apiClient.get(`topics/${topicId}/tasks`, {
    authenticated: true,
    expectedStatus: 200,
    signal,
  });

  if (
    !Array.isArray(response) ||
    !response.every((task) => isLearningTaskResponse(task, topicId))
  ) {
    throw new ResponseFormatError('The learning tasks response has an unexpected format');
  }

  return response;
}

export async function createLearningTask(topicId: number, request: CreateLearningTaskRequest) {
  const response: unknown = await apiClient.post(`topics/${topicId}/tasks`, request, {
    authenticated: true,
    expectedStatus: 201,
  });

  if (!isLearningTaskResponse(response, topicId)) {
    throw new ResponseFormatError('The created learning task response has an unexpected format');
  }

  return response;
}

export async function getLearningTask(
  taskId: number,
  signal?: AbortSignal,
): Promise<LearningTaskResponse> {
  const response: unknown = await apiClient.get(`tasks/${taskId}`, {
    authenticated: true,
    expectedStatus: 200,
    signal,
  });
  return validateTaskResponse(response, 'The learning task response has an unexpected format');
}

export async function updateLearningTask(
  taskId: number,
  request: UpdateLearningTaskRequest,
): Promise<LearningTaskResponse> {
  const response: unknown = await apiClient.put(`tasks/${taskId}`, request, {
    authenticated: true,
    expectedStatus: 200,
  });
  return validateTaskResponse(
    response,
    'The updated learning task response has an unexpected format',
  );
}

export async function updateLearningTaskStatus(
  taskId: number,
  request: UpdateLearningTaskStatusRequest,
): Promise<LearningTaskResponse> {
  const response: unknown = await apiClient.patch(`tasks/${taskId}/status`, request, {
    authenticated: true,
    expectedStatus: 200,
  });
  return validateTaskResponse(
    response,
    'The learning task status response has an unexpected format',
  );
}

export async function updateLearningTaskPlanning(
  taskId: number,
  request: UpdateLearningTaskPlanningRequest,
): Promise<LearningTaskResponse> {
  const response: unknown = await apiClient.patch(`tasks/${taskId}/planning`, request, {
    authenticated: true,
    expectedStatus: 200,
  });
  return validateTaskResponse(
    response,
    'The learning task planning response has an unexpected format',
  );
}

export async function deleteLearningTask(taskId: number) {
  await apiClient.delete<void>(`tasks/${taskId}`, {
    authenticated: true,
    expectedStatus: 204,
  });
}
