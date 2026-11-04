import { useQuery } from '@tanstack/react-query';
import { getDashboardActivity, getDashboardSummary } from '../api/dashboardApi';
import type { ActivityRange } from '../lib/activityRange';

export const dashboardQueryKeys = {
  all: (userId: number) => ['dashboard', userId] as const,
  summary: (userId: number) => [...dashboardQueryKeys.all(userId), 'summary'] as const,
  activities: (userId: number) => [...dashboardQueryKeys.all(userId), 'activity'] as const,
  activity: (userId: number, range: ActivityRange) =>
    [...dashboardQueryKeys.activities(userId), range.from, range.to] as const,
};

export function useDashboardSummary(userId: number) {
  return useQuery({
    queryKey: dashboardQueryKeys.summary(userId),
    queryFn: ({ signal }) => getDashboardSummary(signal),
    staleTime: 30_000,
  });
}

export function useDashboardActivity(userId: number, range: ActivityRange) {
  return useQuery({
    queryKey: dashboardQueryKeys.activity(userId, range),
    queryFn: ({ signal }) => getDashboardActivity(range.from, range.to, signal),
    staleTime: 30_000,
  });
}
