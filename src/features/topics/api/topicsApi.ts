import { apiClient } from '../../../shared/api/apiClient';
import { ResponseFormatError } from '../../../shared/api/apiError';

export const TOPIC_TITLE_MAX_LENGTH = 120;
export const TOPIC_DESCRIPTION_MAX_LENGTH = 2000;

export type TopicStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';

export type CreateTopicRequest = {
  title: string;
  description?: string | null;
};

export type UpdateTopicRequest = {
  title: string;
  description?: string | null;
};

export type UpdateTopicStatusRequest = {
  status: TopicStatus;
};

export type TopicResponse = {
  id: number;
  title: string;
  description: string | null;
  status: TopicStatus;
  createdAt: string;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTopicStatus(value: unknown): value is TopicStatus {
  return value === 'PLANNED' || value === 'IN_PROGRESS' || value === 'COMPLETED';
}

function isTopicResponse(value: unknown): value is TopicResponse {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    Number.isInteger(value.id) &&
    typeof value.title === 'string' &&
    (value.description === null || typeof value.description === 'string') &&
    isTopicStatus(value.status) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

export async function getTopics(signal?: AbortSignal) {
  const response: unknown = await apiClient.get('topics', {
    authenticated: true,
    signal,
  });

  if (!Array.isArray(response) || !response.every(isTopicResponse)) {
    throw new ResponseFormatError('The topics response has an unexpected format');
  }

  return response;
}

export async function createTopic(request: CreateTopicRequest) {
  const response: unknown = await apiClient.post('topics', request, {
    authenticated: true,
  });

  if (!isTopicResponse(response)) {
    throw new ResponseFormatError('The created topic response has an unexpected format');
  }

  return response;
}

export async function getTopic(topicId: number, signal?: AbortSignal) {
  const response: unknown = await apiClient.get(`topics/${topicId}`, {
    authenticated: true,
    signal,
  });

  if (!isTopicResponse(response)) {
    throw new ResponseFormatError('The topic response has an unexpected format');
  }

  return response;
}

export async function updateTopic(topicId: number, request: UpdateTopicRequest) {
  const response: unknown = await apiClient.put(`topics/${topicId}`, request, {
    authenticated: true,
  });

  if (!isTopicResponse(response)) {
    throw new ResponseFormatError('The updated topic response has an unexpected format');
  }

  return response;
}

export async function updateTopicStatus(topicId: number, request: UpdateTopicStatusRequest) {
  const response: unknown = await apiClient.patch(`topics/${topicId}/status`, request, {
    authenticated: true,
  });

  if (!isTopicResponse(response)) {
    throw new ResponseFormatError('The topic status response has an unexpected format');
  }

  return response;
}

export async function deleteTopic(topicId: number) {
  await apiClient.delete<void>(`topics/${topicId}`, {
    authenticated: true,
    expectedStatus: 204,
  });
}
