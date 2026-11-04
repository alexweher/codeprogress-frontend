import { apiClient } from '../../../shared/api/apiClient';
import { ResponseFormatError } from '../../../shared/api/apiError';
import { assertValidActivityRange, getInclusivePeriodDays } from '../lib/activityRange';

export type DashboardSummaryResponse = {
  totalTopics: number;
  plannedTasks: number;
  activeTasks: number;
  completedTasks: number;
  totalStudyMinutes: number;
  studyMinutesLast7Days: number;
  studySessionsCount: number;
  completionPercent: number;
  lastStudyDate: string | null;
};

export type DailyActivityResponse = {
  date: string;
  studyMinutes: number;
  studySessionsCount: number;
};

export type DashboardActivityResponse = {
  from: string;
  to: string;
  timeZone: string;
  days: DailyActivityResponse[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isLocalDate(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isDashboardSummaryResponse(value: unknown): value is DashboardSummaryResponse {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.totalTopics) &&
    isNonNegativeInteger(value.plannedTasks) &&
    isNonNegativeInteger(value.activeTasks) &&
    isNonNegativeInteger(value.completedTasks) &&
    isNonNegativeInteger(value.totalStudyMinutes) &&
    isNonNegativeInteger(value.studyMinutesLast7Days) &&
    isNonNegativeInteger(value.studySessionsCount) &&
    isNonNegativeInteger(value.completionPercent) &&
    value.completionPercent <= 100 &&
    (value.lastStudyDate === null || isLocalDate(value.lastStudyDate))
  );
}

function isDailyActivityResponse(value: unknown): value is DailyActivityResponse {
  return (
    isRecord(value) &&
    isLocalDate(value.date) &&
    isNonNegativeInteger(value.studyMinutes) &&
    isNonNegativeInteger(value.studySessionsCount)
  );
}

function isDashboardActivityResponse(value: unknown): value is DashboardActivityResponse {
  return (
    isRecord(value) &&
    isLocalDate(value.from) &&
    isLocalDate(value.to) &&
    typeof value.timeZone === 'string' &&
    value.timeZone.length > 0 &&
    Array.isArray(value.days) &&
    value.days.every(isDailyActivityResponse)
  );
}

export async function getDashboardSummary(signal?: AbortSignal) {
  const response: unknown = await apiClient.get('dashboard/summary', {
    authenticated: true,
    signal,
  });

  if (!isDashboardSummaryResponse(response)) {
    throw new ResponseFormatError('The dashboard summary has an unexpected format');
  }

  return response;
}

export async function getDashboardActivity(from: string, to: string, signal?: AbortSignal) {
  const range = { from, to };
  assertValidActivityRange(range);
  const searchParams = new URLSearchParams({ from, to });
  const response: unknown = await apiClient.get(`dashboard/activity?${searchParams.toString()}`, {
    authenticated: true,
    signal,
  });

  if (
    !isDashboardActivityResponse(response) ||
    response.from !== from ||
    response.to !== to ||
    response.days.length !== getInclusivePeriodDays(range) ||
    response.days[0]?.date !== from ||
    response.days.at(-1)?.date !== to
  ) {
    throw new ResponseFormatError('The dashboard activity has an unexpected format');
  }

  return response;
}
