import { screen, waitFor, within } from '@testing-library/react';
import type { Mock } from 'vitest';
import { authSession } from '../auth/model/authSession';
import { getDashboardActivity, getDashboardSummary } from './api/dashboardApi';
import {
  assertValidActivityRange,
  getInclusivePeriodDays,
  getRecentActivityRange,
} from './lib/activityRange';
import { dashboardQueryKeys } from './model/dashboardQueries';
import { createTestQueryClient, renderApp } from '../../test/renderApp';

const loginResponse = {
  accessToken: 'dashboard-test-token',
  tokenType: 'Bearer',
  expiresIn: 3600,
};

const currentUser = {
  id: 42,
  email: 'dashboard@example.com',
  createdAt: '2026-10-26T10:00:00',
  updatedAt: '2026-10-26T10:00:00',
};

const summaryResponse = {
  totalTopics: 4,
  plannedTasks: 2,
  activeTasks: 1,
  completedTasks: 3,
  totalStudyMinutes: 420,
  studyMinutesLast7Days: 150,
  studySessionsCount: 8,
  completionPercent: 50,
  lastStudyDate: '2026-10-20',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function apiError(status: number, message: string, path: string) {
  return {
    timestamp: '2026-10-26T10:00:00',
    status,
    error: status === 401 ? 'Unauthorized' : 'Internal Server Error',
    message,
    path,
    fieldErrors: [],
  };
}

function createActivityResponse(minutesByIndex: Partial<Record<number, number>> = {}) {
  const range = getRecentActivityRange();
  const [year, month, day] = range.from.split('-').map(Number);
  const date = new Date(year ?? 2026, (month ?? 1) - 1, day ?? 1);

  return {
    ...range,
    timeZone: 'Europe/Moscow',
    days: Array.from({ length: 30 }, (_, index) => {
      const current = new Date(date);
      current.setDate(current.getDate() + index);
      const dateValue = [
        current.getFullYear(),
        String(current.getMonth() + 1).padStart(2, '0'),
        String(current.getDate()).padStart(2, '0'),
      ].join('-');
      const studyMinutes = minutesByIndex[index] ?? 0;
      return {
        date: dateValue,
        studyMinutes,
        studySessionsCount: studyMinutes === 0 ? 0 : 1,
      };
    }),
  };
}

type DashboardHandlers = {
  summary?: () => Promise<Response>;
  activity?: () => Promise<Response>;
};

function installApiMock(fetchMock: Mock<typeof fetch>, handlers: DashboardHandlers = {}) {
  fetchMock.mockImplementation((input) => {
    const url =
      input instanceof URL
        ? input
        : new URL(typeof input === 'string' ? input : input.url, window.location.origin);

    if (url.pathname === '/api/auth/login') {
      return Promise.resolve(jsonResponse(loginResponse));
    }

    if (url.pathname === '/api/users/me') {
      return Promise.resolve(jsonResponse(currentUser));
    }

    if (url.pathname === '/api/dashboard/summary') {
      return handlers.summary?.() ?? Promise.resolve(jsonResponse(summaryResponse));
    }

    if (url.pathname === '/api/dashboard/activity') {
      return (
        handlers.activity?.() ?? Promise.resolve(jsonResponse(createActivityResponse({ 28: 90 })))
      );
    }

    throw new Error(`Unexpected request: ${url.pathname}`);
  });
}

async function signInAndOpenDashboard(fetchMock: Mock<typeof fetch>, handlers?: DashboardHandlers) {
  installApiMock(fetchMock, handlers);
  const view = renderApp('/login');

  await view.user.type(screen.getByLabelText('Email'), 'dashboard@example.com');
  await view.user.type(screen.getByLabelText('Password'), 'dashboard-password');
  await view.user.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('heading', { name: /you’re signed in/i });
  await view.user.click(screen.getByRole('link', { name: /dashboard/i }));

  return view;
}

describe('dashboard API and page', () => {
  let fetchMock: Mock<typeof fetch>;

  beforeEach(() => {
    authSession.clear();
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    authSession.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('gets the typed summary and activity responses with the bearer token', async () => {
    authSession.start('current-dashboard-token');
    const activity = createActivityResponse();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(summaryResponse))
      .mockResolvedValueOnce(jsonResponse(activity));

    await expect(getDashboardSummary()).resolves.toEqual(summaryResponse);
    await expect(getDashboardActivity(activity.from, activity.to)).resolves.toEqual(activity);

    const [summaryUrl, summaryInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const [activityUrl, activityInit] = fetchMock.mock.calls[1] as [URL, RequestInit];
    expect(summaryUrl.pathname).toBe('/api/dashboard/summary');
    expect(activityUrl.pathname).toBe('/api/dashboard/activity');
    expect(activityUrl.searchParams.get('from')).toBe(activity.from);
    expect(activityUrl.searchParams.get('to')).toBe(activity.to);
    expect(new Headers(summaryInit.headers).get('Authorization')).toBe(
      'Bearer current-dashboard-token',
    );
    expect(new Headers(activityInit.headers).get('Authorization')).toBe(
      'Bearer current-dashboard-token',
    );
  });

  it('renders summary metrics and all zero/non-zero activity days', async () => {
    await signInAndOpenDashboard(fetchMock);

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeVisible();
    expect(screen.getByText('420')).toBeVisible();
    expect(screen.getByText('50%')).toBeVisible();
    const activity = screen.getByRole('list', {
      name: 'Daily study activity for the last 30 days',
    });
    expect(within(activity).getAllByRole('listitem')).toHaveLength(30);
    expect(
      within(activity).getAllByLabelText(/0 study minutes, 0 sessions/i).length,
    ).toBeGreaterThan(0);
    expect(within(activity).getByLabelText(/90 study minutes, 1 sessions/i)).toBeVisible();
  });

  it('shows a normal empty state for a new user', async () => {
    await signInAndOpenDashboard(fetchMock, {
      summary: () =>
        Promise.resolve(
          jsonResponse({
            totalTopics: 0,
            plannedTasks: 0,
            activeTasks: 0,
            completedTasks: 0,
            totalStudyMinutes: 0,
            studyMinutesLast7Days: 0,
            studySessionsCount: 0,
            completionPercent: 0,
            lastStudyDate: null,
          }),
        ),
      activity: () => Promise.resolve(jsonResponse(createActivityResponse())),
    });

    expect(await screen.findByRole('heading', { name: /your learning activity/i })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows an accessible loading state while dashboard requests are pending', async () => {
    await signInAndOpenDashboard(fetchMock, {
      summary: () => new Promise<Response>(() => undefined),
      activity: () => new Promise<Response>(() => undefined),
    });

    expect(await screen.findByRole('status')).toHaveTextContent('Loading dashboard…');
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
  });

  it('shows backend HTTP errors and retries failed requests', async () => {
    let summaryAttempts = 0;
    const { user } = await signInAndOpenDashboard(fetchMock, {
      summary: () => {
        summaryAttempts += 1;
        return Promise.resolve(
          summaryAttempts === 1
            ? jsonResponse(
                apiError(500, 'An unexpected server error occurred', '/api/dashboard/summary'),
                500,
              )
            : jsonResponse(summaryResponse),
        );
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An unexpected server error occurred',
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeVisible();
    expect(summaryAttempts).toBe(2);
  });

  it('shows a distinct network error', async () => {
    await signInAndOpenDashboard(fetchMock, {
      summary: () => Promise.reject(new TypeError('Failed to fetch')),
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be reached/i);
  });

  it('safely logs out and clears cached data on an authenticated 401', async () => {
    const queryClient = createTestQueryClient();
    installApiMock(fetchMock, {
      summary: () =>
        Promise.resolve(
          jsonResponse(
            apiError(
              401,
              'Authentication is required or token is invalid',
              '/api/dashboard/summary',
            ),
            401,
          ),
        ),
    });
    const { user } = renderApp('/login', queryClient);
    queryClient.setQueryData(['private', 42], { private: true });

    await user.type(screen.getByLabelText('Email'), 'dashboard@example.com');
    await user.type(screen.getByLabelText('Password'), 'dashboard-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { name: /you’re signed in/i });
    await user.click(screen.getByRole('link', { name: /dashboard/i }));

    expect(await screen.findByRole('heading', { name: /sign in to codeprogress/i })).toBeVisible();
    expect(authSession.getAccessToken()).toBeNull();
    expect(queryClient.getQueryData(['private', 42])).toBeUndefined();
  });

  it('removes dashboard cache on manual logout', async () => {
    const queryClient = createTestQueryClient();
    installApiMock(fetchMock);
    const { user } = renderApp('/login', queryClient);

    await user.type(screen.getByLabelText('Email'), 'dashboard@example.com');
    await user.type(screen.getByLabelText('Password'), 'dashboard-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { name: /you’re signed in/i });
    await user.click(screen.getByRole('link', { name: /dashboard/i }));
    await screen.findByRole('heading', { name: 'Dashboard' });

    expect(queryClient.getQueryData(dashboardQueryKeys.summary(42))).toEqual(summaryResponse);
    await user.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0));
  });

  it('protects /app/dashboard without an in-memory session', () => {
    renderApp('/app/dashboard');

    expect(screen.getByRole('heading', { name: /sign in to codeprogress/i })).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses an inclusive local 30-day default and enforces the 366-day boundary', () => {
    const range = getRecentActivityRange(new Date(2026, 2, 1, 12));

    expect(range).toEqual({ from: '2026-01-31', to: '2026-03-01' });
    expect(getInclusivePeriodDays(range)).toBe(30);
    expect(() => assertValidActivityRange({ from: '2025-01-01', to: '2026-01-01' })).not.toThrow();
    expect(() => assertValidActivityRange({ from: '2024-12-31', to: '2026-01-01' })).toThrow(
      /366 days/,
    );
  });

  it('provides accessible headings and a keyboard-focusable activity region', async () => {
    const { user } = await signInAndOpenDashboard(fetchMock);
    await screen.findByRole('heading', { name: 'Dashboard' });

    expect(screen.getByRole('heading', { name: 'Progress summary' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Study minutes by day' })).toBeVisible();
    const scroller = screen.getByLabelText('Scrollable daily activity');
    scroller.focus();
    expect(scroller).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Logout' })).not.toHaveFocus();
  });
});
