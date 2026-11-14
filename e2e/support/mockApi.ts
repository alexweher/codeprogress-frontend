import type { Page, Route } from '@playwright/test';

export const fakeUser = {
  id: 42,
  email: 'browser.user@example.test',
  createdAt: '2026-01-01T10:00:00',
  updatedAt: '2026-01-01T10:00:00',
};

export const fakeTopic = {
  id: 7,
  title: 'Browser testing foundations',
  description: 'A deliberately long synthetic description used only by mocked browser tests.',
  status: 'PLANNED',
  createdAt: '2026-01-02T10:00:00',
  updatedAt: '2026-01-02T10:00:00',
};

export const freshSessionTopic = {
  ...fakeTopic,
  id: 8,
  title: 'Fresh session topic data',
  description: 'A response that is available only after the mocked re-login.',
  updatedAt: '2026-01-04T10:00:00',
};

export const fakeTask = {
  id: 11,
  topicId: 7,
  title: 'Verify accessible dialogs',
  description: 'Synthetic task data.',
  difficulty: 'MEDIUM',
  status: 'PLANNED',
  deadline: null,
  priority: 'MEDIUM',
  createdAt: '2026-01-03T10:00:00',
  updatedAt: '2026-01-03T10:00:00',
};

type MockApiOptions = {
  dashboardNetworkError?: boolean;
  malformedLogin?: boolean;
  protected401Path?: string;
  registerFieldError?: boolean;
  ambiguousTaskDelete?: boolean;
};

export type MockApiState = {
  requests: string[];
  dashboardSummaryRequests: number;
  dashboardAvailable: boolean;
  topicsRequests: number;
  setTopicsResponse: (topics: (typeof fakeTopic)[]) => void;
  pauseTopicsResponses: () => void;
  resumeTopicsResponses: () => void;
  taskDeleteRequests: number;
  taskGetRequests: number;
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function apiError(status: number, path: string, message: string, fieldErrors: unknown[] = []) {
  return {
    timestamp: '2026-01-01T00:00:00Z',
    status,
    error: status === 401 ? 'Unauthorized' : 'Bad Request',
    message,
    path,
    fieldErrors,
  };
}

function activity(from: string, to: string) {
  const days = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const last = new Date(`${to}T00:00:00Z`);
  while (cursor <= last) {
    days.push({
      date: cursor.toISOString().slice(0, 10),
      studyMinutes: 0,
      studySessionsCount: 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return { from, to, timeZone: 'Europe/Moscow', days };
}

export async function installMockApi(page: Page, options: MockApiOptions = {}) {
  let topicsResponse = [fakeTopic];
  let topicsResponseBarrier: Promise<void> | null = null;
  let releaseTopicsResponses: (() => void) | null = null;
  const state: MockApiState = {
    requests: [],
    dashboardSummaryRequests: 0,
    dashboardAvailable: !options.dashboardNetworkError,
    topicsRequests: 0,
    setTopicsResponse: (topics) => {
      topicsResponse = topics;
    },
    pauseTopicsResponses: () => {
      if (topicsResponseBarrier) {
        throw new Error('Topics responses are already paused.');
      }

      topicsResponseBarrier = new Promise((resolve) => {
        releaseTopicsResponses = resolve;
      });
    },
    resumeTopicsResponses: () => {
      releaseTopicsResponses?.();
      releaseTopicsResponses = null;
      topicsResponseBarrier = null;
    },
    taskDeleteRequests: 0,
    taskGetRequests: 0,
  };
  const runtime = globalThis as { process?: { env?: Record<string, string | undefined> } };
  const mockOrigin =
    runtime.process?.env?.CODEPROGRESS_MOCK_E2E_BASE_URL ?? 'http://127.0.0.1:5173';
  await page.route(`${mockOrigin}/api/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    state.requests.push(`${method} ${path}`);

    if (options.protected401Path === path) {
      return json(
        route,
        apiError(401, path, 'Authentication is required or token is invalid'),
        401,
      );
    }

    if (path === '/api/auth/login' && method === 'POST') {
      if (options.malformedLogin) return json(route, { token: 'wrong-shape' });
      return json(route, {
        accessToken: 'mocked.jwt.value',
        tokenType: 'Bearer',
        expiresIn: 3600,
      });
    }
    if (path === '/api/auth/register' && method === 'POST') {
      if (options.registerFieldError) {
        return json(
          route,
          apiError(400, path, 'Request validation failed', [
            { field: 'email', message: 'This mocked email is rejected.' },
          ]),
          400,
        );
      }
      return json(route, fakeUser, 201);
    }
    if (path === '/api/users/me') return json(route, fakeUser);

    if (path === '/api/dashboard/summary') {
      state.dashboardSummaryRequests += 1;
      if (!state.dashboardAvailable) return route.abort('failed');
      return json(route, {
        totalTopics: 1,
        plannedTasks: 1,
        activeTasks: 0,
        completedTasks: 0,
        totalStudyMinutes: 0,
        studyMinutesLast7Days: 0,
        studySessionsCount: 0,
        completionPercent: 0,
        lastStudyDate: null,
      });
    }
    if (path === '/api/dashboard/activity') {
      const from = url.searchParams.get('from') ?? '';
      const to = url.searchParams.get('to') ?? '';
      return json(route, activity(from, to));
    }

    if (path === '/api/topics' && method === 'GET') {
      state.topicsRequests += 1;
      const barrier = topicsResponseBarrier;
      if (barrier) {
        await barrier;
      }
      return json(route, topicsResponse);
    }
    if (path === '/api/topics/7' && method === 'GET') return json(route, fakeTopic);
    if (path === '/api/topics/7/tasks' && method === 'GET') return json(route, [fakeTask]);
    if (path === '/api/topics/7/sessions' && method === 'GET') return json(route, []);
    if (path === '/api/tasks/11' && method === 'GET') {
      state.taskGetRequests += 1;
      return json(route, fakeTask);
    }
    if (path === '/api/tasks/11' && method === 'DELETE') {
      state.taskDeleteRequests += 1;
      if (options.ambiguousTaskDelete) return route.abort('failed');
      return route.fulfill({ status: 204, body: '' });
    }

    return json(route, apiError(404, path, 'Mock route not configured'), 404);
  });

  return state;
}
