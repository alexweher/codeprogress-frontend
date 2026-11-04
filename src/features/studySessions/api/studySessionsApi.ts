import { apiClient } from '../../../shared/api/apiClient';
import { ResponseFormatError } from '../../../shared/api/apiError';
import { isLocalDate } from '../../learningTasks/lib/localDate';

export const STUDY_SESSION_NOTE_MAX_LENGTH = 2000;
export const STUDY_SESSION_DURATION_MAX = 2_147_483_647;

export type CreateStudySessionRequest = {
  sessionDate: string;
  durationMinutes: number;
  note: string | null;
  completedTaskIds: number[];
};

export type UpdateStudySessionRequest = CreateStudySessionRequest;

export type StudySessionResponse = {
  id: number;
  topicId: number;
  sessionDate: string;
  durationMinutes: number;
  note: string | null;
  completedTaskIds: number[];
  createdAt: string;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isLocalDateTime(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?$/.exec(value);
  if (!match || !isLocalDate(match[1])) {
    return false;
  }

  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const second = Number(match[4]);
  return hour <= 23 && minute <= 59 && second <= 59;
}

export function isStudySessionResponse(
  value: unknown,
  topicId?: number,
  sessionId?: number,
): value is StudySessionResponse {
  if (
    !isRecord(value) ||
    !isPositiveSafeInteger(value.id) ||
    (sessionId !== undefined && value.id !== sessionId) ||
    !isPositiveSafeInteger(value.topicId) ||
    (topicId !== undefined && value.topicId !== topicId) ||
    !isLocalDate(value.sessionDate) ||
    !isPositiveSafeInteger(value.durationMinutes) ||
    value.durationMinutes > STUDY_SESSION_DURATION_MAX ||
    (value.note !== null && typeof value.note !== 'string') ||
    !Array.isArray(value.completedTaskIds) ||
    !value.completedTaskIds.every(isPositiveSafeInteger) ||
    new Set(value.completedTaskIds).size !== value.completedTaskIds.length ||
    !isLocalDateTime(value.createdAt) ||
    !isLocalDateTime(value.updatedAt)
  ) {
    return false;
  }

  return true;
}

export async function getStudySessions(topicId: number, signal?: AbortSignal) {
  const response: unknown = await apiClient.get(`topics/${topicId}/sessions`, {
    authenticated: true,
    expectedStatus: 200,
    signal,
  });

  if (
    !Array.isArray(response) ||
    !response.every((session) => isStudySessionResponse(session, topicId))
  ) {
    throw new ResponseFormatError('The study sessions response has an unexpected format');
  }

  return response;
}

export async function createStudySession(topicId: number, request: CreateStudySessionRequest) {
  const response: unknown = await apiClient.post(`topics/${topicId}/sessions`, request, {
    authenticated: true,
    expectedStatus: 201,
  });

  if (!isStudySessionResponse(response, topicId)) {
    throw new ResponseFormatError('The created study session response has an unexpected format');
  }

  return response;
}

function validateStudySessionResponse(response: unknown, message: string, sessionId: number) {
  if (!isStudySessionResponse(response, undefined, sessionId)) {
    throw new ResponseFormatError(message);
  }
  return response;
}

export async function getStudySession(
  sessionId: number,
  signal?: AbortSignal,
): Promise<StudySessionResponse> {
  if (!isPositiveSafeInteger(sessionId)) {
    throw new ResponseFormatError('The study session id must be a positive safe integer');
  }
  const response: unknown = await apiClient.get(`sessions/${sessionId}`, {
    authenticated: true,
    expectedStatus: 200,
    signal,
  });
  return validateStudySessionResponse(
    response,
    'The study session response has an unexpected format',
    sessionId,
  );
}

export async function updateStudySession(
  sessionId: number,
  request: UpdateStudySessionRequest,
): Promise<StudySessionResponse> {
  if (!isPositiveSafeInteger(sessionId)) {
    throw new ResponseFormatError('The study session id must be a positive safe integer');
  }
  const response: unknown = await apiClient.put(`sessions/${sessionId}`, request, {
    authenticated: true,
    expectedStatus: 200,
  });
  return validateStudySessionResponse(
    response,
    'The updated study session response has an unexpected format',
    sessionId,
  );
}

export async function deleteStudySession(sessionId: number): Promise<void> {
  if (!isPositiveSafeInteger(sessionId)) {
    throw new ResponseFormatError('The study session id must be a positive safe integer');
  }
  await apiClient.delete<void>(`sessions/${sessionId}`, {
    authenticated: true,
    expectedStatus: 204,
  });
}
