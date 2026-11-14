import type { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import type { Mock } from 'vitest';
import { authSession } from '../auth/model/authSession';
import { dashboardQueryKeys } from '../dashboard/model/dashboardQueries';
import type { LearningTaskResponse } from '../learningTasks/api/learningTasksApi';
import { learningTaskQueryKeys } from '../learningTasks/model/learningTaskQueries';
import {
  createStudySession,
  getStudySessions,
  type StudySessionResponse,
} from './api/studySessionsApi';
import { studySessionQueryKeys } from './model/studySessionQueries';
import { createTestQueryClient, renderApp } from '../../test/renderApp';

const loginResponse = {
  accessToken: 'study-sessions-test-token',
  tokenType: 'Bearer',
  expiresIn: 3600,
};

const currentUser = {
  id: 42,
  email: 'sessions@example.com',
  createdAt: '2026-10-29T10:00:00',
  updatedAt: '2026-10-29T10:00:00',
};

const topic = {
  id: 7,
  title: 'Spring transactions',
  description: 'Transaction boundaries and rollback',
  status: 'IN_PROGRESS',
  createdAt: '2026-10-27T10:00:00',
  updatedAt: '2026-10-29T10:00:00',
} as const;

const task: LearningTaskResponse = {
  id: 11,
  topicId: 7,
  title: 'Practice transaction rollback',
  description: null,
  difficulty: 'MEDIUM',
  status: 'IN_PROGRESS',
  deadline: null,
  priority: 'HIGH',
  createdAt: '2026-10-28T10:15:00',
  updatedAt: '2026-10-28T10:15:00',
};

const session: StudySessionResponse = {
  id: 21,
  topicId: 7,
  sessionDate: '2026-10-29',
  durationMinutes: 45,
  note: 'Worked through rollback examples',
  completedTaskIds: [11],
  createdAt: '2026-10-29T18:30:00.123456',
  updatedAt: '2026-10-29T18:30:00.123456',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function apiError(
  status: number,
  message: string,
  fieldErrors: Array<{ field: string; message: string }> = [],
) {
  return {
    timestamp: '2026-10-29T10:00:00',
    status,
    error: status === 401 ? 'Unauthorized' : status === 409 ? 'Conflict' : 'Bad Request',
    message,
    path: '/api/topics/7/sessions',
    fieldErrors,
  };
}

type SessionHandlers = {
  sessions?: () => Promise<Response>;
  tasks?: () => Promise<Response>;
  create?: (body: unknown) => Promise<Response>;
};

function installApiMock(fetchMock: Mock<typeof fetch>, handlers: SessionHandlers = {}) {
  fetchMock.mockImplementation((input, init) => {
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
    if (url.pathname === '/api/topics') {
      return Promise.resolve(jsonResponse([topic]));
    }
    if (url.pathname === '/api/topics/7') {
      return Promise.resolve(jsonResponse(topic));
    }
    if (url.pathname === '/api/topics/7/tasks') {
      return handlers.tasks?.() ?? Promise.resolve(jsonResponse([task]));
    }
    if (url.pathname === '/api/topics/7/sessions' && init?.method === 'POST') {
      const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : null;
      return handlers.create?.(body) ?? Promise.resolve(jsonResponse(session, 201));
    }
    if (url.pathname === '/api/topics/7/sessions') {
      return handlers.sessions?.() ?? Promise.resolve(jsonResponse([session]));
    }

    throw new Error(`Unexpected request: ${url.pathname}`);
  });
}

async function signInAndOpenTopic(
  fetchMock: Mock<typeof fetch>,
  handlers?: SessionHandlers,
  queryClient?: QueryClient,
  waitForDetails = true,
) {
  installApiMock(fetchMock, handlers);
  const view = renderApp('/app/topics/7', queryClient);
  await view.user.type(screen.getByLabelText('Email'), currentUser.email);
  await view.user.type(screen.getByLabelText('Password'), 'not-a-real-password');
  await view.user.click(screen.getByRole('button', { name: 'Sign in' }));
  if (waitForDetails) {
    await screen.findByRole('heading', { name: topic.title });
  }
  return view;
}

function requestsFor(fetchMock: Mock<typeof fetch>, path: string, method?: string) {
  return fetchMock.mock.calls.filter(([input, init]) => {
    const url =
      input instanceof URL
        ? input
        : new URL(typeof input === 'string' ? input : input.url, window.location.origin);
    return url.pathname === path && (method === undefined || init?.method === method);
  });
}

async function openCreateForm(view: Awaited<ReturnType<typeof signInAndOpenTopic>>) {
  await screen.findByRole('list', { name: 'Study sessions' });
  await view.user.click(screen.getByRole('button', { name: 'Add session' }));
}

describe('StudySessions list and create flow', () => {
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

  it('uses the exact Topic endpoint, bearer auth and AbortSignal for GET', async () => {
    authSession.start('sessions-api-token');
    fetchMock.mockResolvedValueOnce(jsonResponse([session]));
    const controller = new AbortController();

    await expect(getStudySessions(7, controller.signal)).resolves.toEqual([session]);

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/api/topics/7/sessions');
    expect(init.method).toBe('GET');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer sessions-api-token');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('uses HTTP 201 and sends the exact verified create body', async () => {
    authSession.start('sessions-api-token');
    fetchMock.mockResolvedValueOnce(jsonResponse(session, 201));

    await expect(
      createStudySession(7, {
        sessionDate: '2026-10-29',
        durationMinutes: 45,
        note: null,
        completedTaskIds: [11],
      }),
    ).resolves.toEqual(session);

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/api/topics/7/sessions');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer sessions-api-token');
    if (typeof init.body !== 'string') {
      throw new Error('Expected the create-study-session request body to be JSON');
    }
    expect(JSON.parse(init.body) as unknown).toEqual({
      sessionDate: '2026-10-29',
      durationMinutes: 45,
      note: null,
      completedTaskIds: [11],
    });
  });

  it('rejects malformed date, LocalDateTime, Topic and completed-task responses', async () => {
    authSession.start('sessions-api-token');
    fetchMock
      .mockResolvedValueOnce(jsonResponse([{ ...session, sessionDate: '2026-02-30' }]))
      .mockResolvedValueOnce(jsonResponse([{ ...session, createdAt: '2026-10-29T25:00:00' }]))
      .mockResolvedValueOnce(jsonResponse([{ ...session, topicId: 8 }]))
      .mockResolvedValueOnce(jsonResponse([{ ...session, completedTaskIds: [11, 11] }]));

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(getStudySessions(7)).rejects.toMatchObject({ name: 'ResponseFormatError' });
    }
  });

  it('renders session date, duration, note and completed task title', async () => {
    await signInAndOpenTopic(fetchMock);

    const list = await screen.findByRole('list', { name: 'Study sessions' });
    expect(within(list).getByText('29.10.2026')).toBeVisible();
    expect(within(list).getByText('45 min')).toBeVisible();
    expect(within(list).getByText(session.note ?? '')).toBeVisible();
    expect(within(list).getByText(task.title)).toBeVisible();
  });

  it('shows loading, empty, error and Retry states without pagination', async () => {
    let attempts = 0;
    let resolveFirstRead: ((response: Response) => void) | undefined;
    const view = await signInAndOpenTopic(fetchMock, {
      sessions: () => {
        attempts += 1;
        if (attempts === 1) {
          return new Promise<Response>((resolve) => {
            resolveFirstRead = resolve;
          });
        }
        return Promise.resolve(jsonResponse([]));
      },
    });

    expect(await screen.findByText('Loading study sessions…')).toBeVisible();
    resolveFirstRead?.(jsonResponse(apiError(500, 'Temporary failure'), 500));
    expect(await screen.findByRole('alert')).toHaveTextContent('Temporary failure');
    await view.user.click(screen.getByRole('button', { name: 'Retry sessions' }));
    expect(await screen.findByRole('heading', { name: 'No study sessions yet' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /next page/i })).not.toBeInTheDocument();
  });

  it('shows a distinct network error for the sessions list', async () => {
    await signInAndOpenTopic(fetchMock, {
      sessions: () => Promise.reject(new TypeError('Failed to fetch')),
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
  });

  it('validates required date, positive integer duration and upper boundaries', async () => {
    const view = await signInAndOpenTopic(fetchMock);
    await openCreateForm(view);
    await view.user.click(screen.getByRole('button', { name: 'Save session' }));
    expect(screen.getByText('Enter a valid session date.')).toBeVisible();
    expect(screen.getByText('Enter a whole number greater than zero.')).toBeVisible();

    await view.user.type(screen.getByLabelText('Session date'), '2026-10-29');
    await view.user.type(screen.getByLabelText('Duration (minutes)'), '2147483648');
    await view.user.click(screen.getByRole('button', { name: 'Save session' }));
    expect(screen.getByText(/2147483647 minutes or fewer/i)).toBeVisible();
    expect(requestsFor(fetchMock, '/api/topics/7/sessions', 'POST')).toHaveLength(0);
  });

  it('allows nullable notes and no completed tasks', async () => {
    let requestBody: unknown;
    let sessionReads = 0;
    const view = await signInAndOpenTopic(fetchMock, {
      sessions: () => {
        sessionReads += 1;
        return Promise.resolve(
          jsonResponse(
            sessionReads === 1 ? [] : [{ ...session, note: null, completedTaskIds: [] }],
          ),
        );
      },
      create: (body) => {
        requestBody = body;
        return Promise.resolve(jsonResponse({ ...session, note: null, completedTaskIds: [] }, 201));
      },
    });
    await screen.findByRole('heading', { name: 'No study sessions yet' });
    await view.user.click(screen.getByRole('button', { name: 'Add session' }));
    await view.user.type(screen.getByLabelText('Session date'), '2026-10-29');
    await view.user.type(screen.getByLabelText('Duration (minutes)'), '1');
    await view.user.click(screen.getByRole('button', { name: 'Save session' }));

    await screen.findByText('Study session recorded.');
    expect(requestBody).toEqual({
      sessionDate: '2026-10-29',
      durationMinutes: 1,
      note: null,
      completedTaskIds: [],
    });
  });

  it('submits only current Topic tasks and explains atomic completion', async () => {
    let requestBody: unknown;
    const view = await signInAndOpenTopic(fetchMock, {
      create: (body) => {
        requestBody = body;
        return Promise.resolve(jsonResponse(session, 201));
      },
    });
    await openCreateForm(view);
    expect(screen.getByText(/moved to Completed atomically/i)).toBeVisible();
    await view.user.type(screen.getByLabelText('Session date'), '2026-10-29');
    await view.user.type(screen.getByLabelText('Duration (minutes)'), '45');
    await view.user.click(screen.getByRole('checkbox', { name: /Practice transaction rollback/i }));
    await view.user.click(screen.getByRole('button', { name: 'Save session' }));
    await screen.findByText('Study session recorded.');
    expect(requestBody).toMatchObject({ completedTaskIds: [11] });
  });

  it('maps backend field validation and conflict errors', async () => {
    let attempts = 0;
    const view = await signInAndOpenTopic(fetchMock, {
      create: () => {
        attempts += 1;
        return Promise.resolve(
          attempts === 1
            ? jsonResponse(
                apiError(400, 'Request validation failed', [
                  { field: 'durationMinutes', message: 'Duration must be greater than zero' },
                ]),
                400,
              )
            : jsonResponse(apiError(409, 'Operation conflicts with the current data state'), 409),
        );
      },
    });
    await openCreateForm(view);
    await view.user.type(screen.getByLabelText('Session date'), '2026-10-29');
    await view.user.type(screen.getByLabelText('Duration (minutes)'), '45');
    await view.user.click(screen.getByRole('button', { name: 'Save session' }));
    expect(await screen.findByText('Duration must be greater than zero')).toBeVisible();
    await view.user.click(screen.getByRole('button', { name: 'Save session' }));
    expect(
      await screen.findByText('Operation conflicts with the current data state'),
    ).toBeVisible();
  });

  it('blocks duplicate submit while POST is pending', async () => {
    let resolveCreate: ((response: Response) => void) | undefined;
    const view = await signInAndOpenTopic(fetchMock, {
      create: () =>
        new Promise<Response>((resolve) => {
          resolveCreate = resolve;
        }),
    });
    await openCreateForm(view);
    await view.user.type(screen.getByLabelText('Session date'), '2026-10-29');
    await view.user.type(screen.getByLabelText('Duration (minutes)'), '45');
    await view.user.click(screen.getByRole('button', { name: 'Save session' }));
    const pendingButton = await screen.findByRole('button', { name: 'Saving session…' });
    expect(pendingButton).toBeDisabled();
    await view.user.click(pendingButton);
    expect(requestsFor(fetchMock, '/api/topics/7/sessions', 'POST')).toHaveLength(1);
    resolveCreate?.(jsonResponse(session, 201));
    await screen.findByText('Study session recorded.');
  });

  it('refreshes sessions/tasks and invalidates both Dashboard views and selected task detail', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(dashboardQueryKeys.summary(42), { totalStudyMinutes: 0 });
    queryClient.setQueryData(
      dashboardQueryKeys.activity(42, { from: '2026-10-01', to: '2026-10-29' }),
      { days: [] },
    );
    queryClient.setQueryData(learningTaskQueryKeys.detail(42, 11), task);
    queryClient.setQueryData(studySessionQueryKeys.list(99, 7), [
      { ...session, note: 'Other user data' },
    ]);
    const view = await signInAndOpenTopic(fetchMock, undefined, queryClient);
    await openCreateForm(view);
    await view.user.type(screen.getByLabelText('Session date'), '2026-10-29');
    await view.user.type(screen.getByLabelText('Duration (minutes)'), '45');
    await view.user.click(screen.getByRole('checkbox', { name: /Practice transaction rollback/i }));
    await view.user.click(screen.getByRole('button', { name: 'Save session' }));
    await screen.findByText('Study session recorded.');

    expect(requestsFor(fetchMock, '/api/topics/7/sessions')).toHaveLength(3);
    expect(requestsFor(fetchMock, '/api/topics/7/tasks')).toHaveLength(2);
    expect(queryClient.getQueryState(dashboardQueryKeys.summary(42))?.isInvalidated).toBe(true);
    expect(
      queryClient.getQueryState(
        dashboardQueryKeys.activity(42, { from: '2026-10-01', to: '2026-10-29' }),
      )?.isInvalidated,
    ).toBe(true);
    expect(queryClient.getQueryState(learningTaskQueryKeys.detail(42, 11))?.isInvalidated).toBe(
      true,
    );
    expect(queryClient.getQueryData(studySessionQueryKeys.list(99, 7))).toEqual([
      { ...session, note: 'Other user data' },
    ]);
  });

  it('logs out and clears all caches on an authenticated 401', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['private', 42], { private: true });
    await signInAndOpenTopic(
      fetchMock,
      { sessions: () => Promise.resolve(jsonResponse(apiError(401, 'Token expired'), 401)) },
      queryClient,
      false,
    );

    expect(await screen.findByRole('heading', { name: /sign in to codeprogress/i })).toBeVisible();
    expect(authSession.getAccessToken()).toBeNull();
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0));
  });

  it('does not apply a delayed create response after logout', async () => {
    let resolveCreate: ((response: Response) => void) | undefined;
    const queryClient = createTestQueryClient();
    const view = await signInAndOpenTopic(
      fetchMock,
      {
        create: () =>
          new Promise<Response>((resolve) => {
            resolveCreate = resolve;
          }),
      },
      queryClient,
    );
    await openCreateForm(view);
    await view.user.type(screen.getByLabelText('Session date'), '2026-10-29');
    await view.user.type(screen.getByLabelText('Duration (minutes)'), '45');
    await view.user.click(screen.getByRole('button', { name: 'Save session' }));
    await screen.findByRole('button', { name: 'Saving session…' });
    await view.user.click(screen.getByRole('button', { name: 'Logout' }));
    resolveCreate?.(jsonResponse(session, 201));

    await screen.findByRole('heading', { name: /sign in to codeprogress/i });
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0));
  });

  it('keeps the protected route closed without an in-memory session', () => {
    renderApp('/app/topics/7');
    expect(screen.getByRole('heading', { name: /sign in to codeprogress/i })).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('supports keyboard navigation through every create control', async () => {
    const view = await signInAndOpenTopic(fetchMock);
    await openCreateForm(view);
    expect(screen.getByLabelText('Session date')).toHaveFocus();
    await view.user.tab();
    expect(screen.getByLabelText('Duration (minutes)')).toHaveFocus();
    await view.user.tab();
    expect(screen.getByLabelText('Notes (optional)')).toHaveFocus();
    await view.user.tab();
    expect(screen.getByRole('checkbox', { name: /Practice transaction rollback/i })).toHaveFocus();
  });
});
