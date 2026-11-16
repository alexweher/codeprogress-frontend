import type { QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nProvider } from '../../shared/i18n/I18nProvider';
import type { Mock } from 'vitest';
import { authSession } from '../auth/model/authSession';
import { dashboardQueryKeys } from '../dashboard/model/dashboardQueries';
import type { LearningTaskResponse } from '../learningTasks/api/learningTasksApi';
import { learningTaskQueryKeys } from '../learningTasks/model/learningTaskQueries';
import {
  deleteStudySession,
  getStudySession,
  updateStudySession,
  type StudySessionResponse,
} from './api/studySessionsApi';
import { parseStudySessionId } from './lib/studySessionId';
import { studySessionQueryKeys } from './model/studySessionQueries';
import { createTestQueryClient, renderApp } from '../../test/renderApp';
import { StudySessionDetailsPage } from '../../pages/StudySessionDetailsPage/StudySessionDetailsPage';

const loginResponse = {
  accessToken: 'study-session-details-test-token',
  tokenType: 'Bearer',
  expiresIn: 3600,
};

const currentUser = {
  id: 42,
  email: 'session-details@example.com',
  createdAt: '2026-10-29T10:00:00',
  updatedAt: '2026-10-29T10:00:00',
};

const topic = {
  id: 7,
  title: 'Database transactions',
  description: 'Atomicity and rollback',
  status: 'IN_PROGRESS',
  createdAt: '2026-10-27T10:00:00',
  updatedAt: '2026-10-29T10:00:00',
} as const;

const firstTask: LearningTaskResponse = {
  id: 11,
  topicId: 7,
  title: 'Practice rollback',
  description: null,
  difficulty: 'MEDIUM',
  status: 'COMPLETED',
  deadline: null,
  priority: 'HIGH',
  createdAt: '2026-10-28T10:15:00',
  updatedAt: '2026-10-29T18:30:00',
};

const secondTask: LearningTaskResponse = {
  ...firstTask,
  id: 12,
  title: 'Review transaction isolation',
  status: 'PLANNED',
};

const session: StudySessionResponse = {
  id: 21,
  topicId: 7,
  sessionDate: '2026-10-29',
  durationMinutes: 45,
  note: 'Rollback practice',
  completedTaskIds: [11],
  createdAt: '2026-10-29T18:30:00.123456',
  updatedAt: '2026-10-29T18:30:00.123456',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function apiError(
  status: number,
  message: string,
  path = '/api/sessions/21',
  fieldErrors: Array<{ field: string; message: string }> = [],
) {
  return {
    timestamp: '2026-10-29T10:00:00',
    status,
    error: status === 401 ? 'Unauthorized' : status === 404 ? 'Not Found' : 'Bad Request',
    message,
    path,
    fieldErrors,
  };
}

type DetailHandlers = {
  detail?: () => Promise<Response>;
  tasks?: () => Promise<Response>;
  update?: (body: unknown) => Promise<Response>;
  delete?: () => Promise<Response>;
};

function installApiMock(fetchMock: Mock<typeof fetch>, handlers: DetailHandlers = {}) {
  let wasDeleted = false;
  fetchMock.mockImplementation((input, init) => {
    const url =
      input instanceof URL
        ? input
        : new URL(typeof input === 'string' ? input : input.url, window.location.origin);

    if (url.pathname === '/api/auth/login') return Promise.resolve(json(loginResponse));
    if (url.pathname === '/api/users/me') return Promise.resolve(json(currentUser));
    if (url.pathname === '/api/topics') return Promise.resolve(json([topic]));
    if (url.pathname === '/api/topics/7') return Promise.resolve(json(topic));
    if (url.pathname === '/api/topics/7/tasks') {
      return handlers.tasks?.() ?? Promise.resolve(json([firstTask, secondTask]));
    }
    if (url.pathname === '/api/topics/7/sessions')
      return Promise.resolve(json(wasDeleted ? [] : [session]));
    if (url.pathname === '/api/sessions/21' && init?.method === 'PUT') {
      const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : null;
      return handlers.update?.(body) ?? Promise.resolve(json({ ...session, ...(body as object) }));
    }
    if (url.pathname === '/api/sessions/21' && init?.method === 'DELETE') {
      const response = handlers.delete?.() ?? Promise.resolve(new Response(null, { status: 204 }));
      return response.then((result) => {
        if (result.status === 204) wasDeleted = true;
        return result;
      });
    }
    if (url.pathname === '/api/sessions/21') {
      return handlers.detail?.() ?? Promise.resolve(json(session));
    }

    throw new Error(`Unexpected request: ${url.pathname}`);
  });
}

async function signInAndOpenSession(
  fetchMock: Mock<typeof fetch>,
  handlers?: DetailHandlers,
  queryClient?: QueryClient,
  waitForDetails = true,
) {
  installApiMock(fetchMock, handlers);
  const view = renderApp('/app/sessions/21', queryClient);
  await view.user.type(screen.getByLabelText('Email'), currentUser.email);
  await view.user.type(screen.getByLabelText('Password'), 'not-a-real-password');
  await view.user.click(screen.getByRole('button', { name: 'Sign in' }));
  if (waitForDetails) {
    await screen.findByRole('heading', { name: 'Study session', level: 1 });
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

describe('StudySession details and update flow', () => {
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

  it('gets details with the exact id, Bearer token and AbortSignal', async () => {
    authSession.start('session-detail-token');
    fetchMock.mockResolvedValueOnce(json(session));
    const controller = new AbortController();

    await expect(getStudySession(21, controller.signal)).resolves.toEqual(session);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/api/sessions/21');
    expect(init.method).toBe('GET');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer session-detail-token');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('rejects invalid ids and a mismatched or malformed response at runtime', async () => {
    authSession.start('session-detail-token');
    await expect(getStudySession(0)).rejects.toMatchObject({ name: 'ResponseFormatError' });
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock
      .mockResolvedValueOnce(json({ ...session, id: 22 }))
      .mockResolvedValueOnce(json({ ...session, updatedAt: '2026-10-29T18:30:00Z' }));
    await expect(getStudySession(21)).rejects.toMatchObject({ name: 'ResponseFormatError' });
    await expect(getStudySession(21)).rejects.toMatchObject({ name: 'ResponseFormatError' });

    expect(parseStudySessionId(undefined)).toBeNull();
    expect(parseStudySessionId('0')).toBeNull();
    expect(parseStudySessionId('1.5')).toBeNull();
    expect(parseStudySessionId('9007199254740992')).toBeNull();
    expect(parseStudySessionId('21')).toBe(21);
  });

  it('renders the invalid-id state without issuing an API request', () => {
    render(
      <I18nProvider>
        <MemoryRouter initialEntries={['/app/sessions/not-a-number']}>
          <Routes>
            <Route path="/app/sessions/:sessionId" element={<StudySessionDetailsPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(
      screen.getByRole('heading', { name: 'This study session address is not valid' }),
    ).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('protects the details route without an in-memory session', () => {
    renderApp('/app/sessions/21');
    expect(screen.getByRole('heading', { name: /sign in to codeprogress/i })).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('navigates from the Topic list and renders session details without task claims', async () => {
    await signInAndOpenSession(fetchMock);

    expect(screen.getByText('45 minutes')).toBeVisible();
    expect(screen.getByText(session.note ?? '')).toBeVisible();
    expect(screen.queryByText(firstTask.title)).not.toBeInTheDocument();
    expect(screen.queryByText('Completed tasks')).not.toBeInTheDocument();
    expect(screen.getAllByText('29.10.2026, 18:30')).toHaveLength(2);
    expect(await screen.findByRole('link', { name: 'Database transactions' })).toHaveAttribute(
      'href',
      '/app/topics/7',
    );
  });

  it('renders a nullable note without exposing the completedTaskIds set', async () => {
    await signInAndOpenSession(fetchMock, {
      detail: () => Promise.resolve(json({ ...session, note: null, completedTaskIds: [] })),
    });

    expect(screen.getByText('No notes recorded.')).toBeVisible();
    expect(screen.queryByText('No tasks recorded.')).not.toBeInTheDocument();
  });

  it('shows loading, retryable HTTP error, network error and owner-scoped 404', async () => {
    let resolveFirst: ((response: Response) => void) | undefined;
    let attempts = 0;
    const view = await signInAndOpenSession(
      fetchMock,
      {
        detail: () => {
          attempts += 1;
          if (attempts === 1) {
            return new Promise<Response>((resolve) => {
              resolveFirst = resolve;
            });
          }
          return Promise.resolve(json(session));
        },
      },
      undefined,
      false,
    );
    expect(await screen.findByText('Loading study session…')).toBeVisible();
    resolveFirst?.(json(apiError(500, 'Temporary failure'), 500));
    expect(await screen.findByRole('alert')).toHaveTextContent('Temporary failure');
    await view.user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Study session', level: 1 })).toBeVisible();
    view.unmount();
    authSession.clear();

    await signInAndOpenSession(
      fetchMock,
      {
        detail: () =>
          Promise.resolve(json(apiError(404, 'Study session with id 21 was not found'), 404)),
      },
      undefined,
      false,
    );
    expect(
      await screen.findByRole('heading', { name: 'This study session is unavailable' }),
    ).toBeVisible();
  });

  it('shows a distinct network error for details', async () => {
    await signInAndOpenSession(
      fetchMock,
      { detail: () => Promise.reject(new TypeError('Failed to fetch')) },
      undefined,
      false,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
  });

  it('updates the exact DTO, supports nullable note, and adds/removes completed tasks', async () => {
    let requestBody: unknown;
    let updated = false;
    const updatedSession = {
      ...session,
      sessionDate: '2026-10-30',
      durationMinutes: 60,
      note: null,
      completedTaskIds: [12],
      updatedAt: '2026-10-30T20:00:00',
    };
    const queryClient = createTestQueryClient();
    const view = await signInAndOpenSession(
      fetchMock,
      {
        tasks: () =>
          Promise.resolve(
            json(
              updated
                ? [firstTask, { ...secondTask, status: 'COMPLETED' }]
                : [firstTask, secondTask],
            ),
          ),
        update: (body) => {
          requestBody = body;
          updated = true;
          return Promise.resolve(json(updatedSession));
        },
      },
      queryClient,
    );
    await view.user.click(screen.getByRole('button', { name: 'Edit session' }));
    const form = screen.getByRole('heading', { name: 'Update study session' }).parentElement;
    if (!form) throw new Error('Missing update form');
    await view.user.clear(within(form).getByLabelText('Session date'));
    await view.user.type(within(form).getByLabelText('Session date'), '2026-10-30');
    await view.user.clear(within(form).getByLabelText('Duration (minutes)'));
    await view.user.type(within(form).getByLabelText('Duration (minutes)'), '60');
    await view.user.clear(within(form).getByLabelText('Notes (optional)'));
    await view.user.click(within(form).getByRole('checkbox', { name: /Practice rollback/i }));
    await view.user.click(
      within(form).getByRole('checkbox', { name: /Review transaction isolation/i }),
    );
    await view.user.click(within(form).getByRole('button', { name: 'Update session' }));

    expect(await screen.findByText('Study session updated.')).toBeVisible();
    expect(requestBody).toEqual({
      sessionDate: '2026-10-30',
      durationMinutes: 60,
      note: null,
      completedTaskIds: [12],
    });
    expect(screen.getByRole('heading', { name: 'Study session', level: 1 })).toBeVisible();
    expect(screen.getByText('October 30, 2026')).toBeVisible();
    expect(screen.getByText('No notes recorded.')).toBeVisible();
  });

  it('synchronizes detail/list and invalidates Dashboard and all affected task caches', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(studySessionQueryKeys.list(42, 7), [session]);
    queryClient.setQueryData(dashboardQueryKeys.summary(42), { totalStudyMinutes: 45 });
    const activityKey = dashboardQueryKeys.activity(42, {
      from: '2026-10-01',
      to: '2026-10-30',
    });
    queryClient.setQueryData(activityKey, { days: [] });
    queryClient.setQueryData(learningTaskQueryKeys.detail(42, 11), firstTask);
    queryClient.setQueryData(learningTaskQueryKeys.detail(42, 12), secondTask);
    queryClient.setQueryData(studySessionQueryKeys.detail(99, 21), {
      ...session,
      note: 'Other user data',
    });
    const updatedSession = { ...session, completedTaskIds: [12], durationMinutes: 60 };
    const view = await signInAndOpenSession(
      fetchMock,
      { update: () => Promise.resolve(json(updatedSession)) },
      queryClient,
    );
    await view.user.click(screen.getByRole('button', { name: 'Edit session' }));
    const form = screen.getByRole('heading', { name: 'Update study session' }).parentElement;
    if (!form) throw new Error('Missing update form');
    await view.user.click(within(form).getByRole('checkbox', { name: /Practice rollback/i }));
    await view.user.click(
      within(form).getByRole('checkbox', { name: /Review transaction isolation/i }),
    );
    await view.user.click(within(form).getByRole('button', { name: 'Update session' }));
    await screen.findByText('Study session updated.');

    expect(queryClient.getQueryData(studySessionQueryKeys.detail(42, 21))).toEqual(updatedSession);
    expect(
      queryClient.getQueryData<StudySessionResponse[]>(studySessionQueryKeys.list(42, 7))?.[0],
    ).toEqual(updatedSession);
    expect(queryClient.getQueryState(dashboardQueryKeys.summary(42))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(activityKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(learningTaskQueryKeys.detail(42, 11))?.isInvalidated).toBe(
      true,
    );
    expect(queryClient.getQueryState(learningTaskQueryKeys.detail(42, 12))?.isInvalidated).toBe(
      true,
    );
    expect(queryClient.getQueryData(studySessionQueryKeys.detail(99, 21))).toEqual({
      ...session,
      note: 'Other user data',
    });
    expect(requestsFor(fetchMock, '/api/topics/7/tasks')).toHaveLength(2);
  });

  it('performs client validation and maps backend fieldErrors and conflicts', async () => {
    let attempts = 0;
    const view = await signInAndOpenSession(fetchMock, {
      update: () => {
        attempts += 1;
        return Promise.resolve(
          attempts === 1
            ? json(
                apiError(400, 'Request validation failed', '/api/sessions/21', [
                  { field: 'durationMinutes', message: 'Duration rejected' },
                ]),
                400,
              )
            : json(apiError(409, 'Operation conflicts with the current data state'), 409),
        );
      },
    });
    await view.user.click(screen.getByRole('button', { name: 'Edit session' }));
    const date = screen.getByLabelText('Session date');
    const duration = screen.getByLabelText('Duration (minutes)');
    await view.user.clear(date);
    await view.user.clear(duration);
    await view.user.click(screen.getByRole('button', { name: 'Update session' }));
    expect(screen.getByText('Enter a valid session date.')).toBeVisible();
    expect(screen.getByText('Enter a whole number greater than zero.')).toBeVisible();
    expect(requestsFor(fetchMock, '/api/sessions/21', 'PUT')).toHaveLength(0);

    await view.user.type(date, '2026-10-29');
    await view.user.type(duration, '45');
    await view.user.click(screen.getByRole('button', { name: 'Update session' }));
    expect(await screen.findByText('Duration rejected')).toBeVisible();
    await view.user.click(screen.getByRole('button', { name: 'Update session' }));
    expect(
      await screen.findByText('Operation conflicts with the current data state'),
    ).toBeVisible();
  });

  it('cancels without PUT and explains reconciliation semantics', async () => {
    const view = await signInAndOpenSession(fetchMock);
    await view.user.click(screen.getByRole('button', { name: 'Edit session' }));
    expect(screen.getByRole('note')).toHaveTextContent(/no other session still references it/i);
    await view.user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('heading', { name: 'Update study session' })).not.toBeInTheDocument();
    expect(requestsFor(fetchMock, '/api/sessions/21', 'PUT')).toHaveLength(0);
  });

  it('blocks duplicate PUT while pending and shows network errors', async () => {
    let rejectUpdate: ((reason: unknown) => void) | undefined;
    const view = await signInAndOpenSession(fetchMock, {
      update: () =>
        new Promise<Response>((_resolve, reject) => {
          rejectUpdate = reject;
        }),
    });
    await view.user.click(screen.getByRole('button', { name: 'Edit session' }));
    await view.user.click(screen.getByRole('button', { name: 'Update session' }));
    const pending = await screen.findByRole('button', { name: 'Updating session…' });
    expect(pending).toBeDisabled();
    await view.user.click(pending);
    expect(requestsFor(fetchMock, '/api/sessions/21', 'PUT')).toHaveLength(1);
    rejectUpdate?.(new TypeError('Failed to fetch'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
  });

  it('logs out and clears caches after a protected 401', async () => {
    const queryClient = createTestQueryClient();
    await signInAndOpenSession(
      fetchMock,
      { detail: () => Promise.resolve(json(apiError(401, 'Token expired'), 401)) },
      queryClient,
      false,
    );
    expect(await screen.findByRole('heading', { name: /sign in to codeprogress/i })).toBeVisible();
    expect(authSession.getAccessToken()).toBeNull();
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0));
  });

  it('ignores a delayed update after logout', async () => {
    let resolveUpdate: ((response: Response) => void) | undefined;
    const queryClient = createTestQueryClient();
    const view = await signInAndOpenSession(
      fetchMock,
      {
        update: () =>
          new Promise<Response>((resolve) => {
            resolveUpdate = resolve;
          }),
      },
      queryClient,
    );
    await view.user.click(screen.getByRole('button', { name: 'Edit session' }));
    await view.user.click(screen.getByRole('button', { name: 'Update session' }));
    await screen.findByRole('button', { name: 'Updating session…' });
    await view.user.click(screen.getByRole('button', { name: 'Logout' }));
    resolveUpdate?.(json({ ...session, durationMinutes: 60 }));
    await screen.findByRole('heading', { name: /sign in to codeprogress/i });
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0));
  });

  it('supports keyboard access through the edit form', async () => {
    const view = await signInAndOpenSession(fetchMock);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit session' })).toBeEnabled());
    const edit = screen.getByRole('button', { name: 'Edit session' });
    edit.focus();
    await view.user.keyboard('{Enter}');
    expect(screen.getByLabelText('Session date')).toHaveFocus();
    await view.user.tab();
    expect(screen.getByLabelText('Duration (minutes)')).toHaveFocus();
    await view.user.tab();
    expect(screen.getByLabelText('Notes (optional)')).toHaveFocus();
    await view.user.tab();
    expect(screen.getByRole('checkbox', { name: /Practice rollback/i })).toHaveFocus();
  });

  it('uses PUT with the exact body and rejects a malformed update response', async () => {
    authSession.start('session-detail-token');
    fetchMock.mockResolvedValueOnce(json(session));
    await expect(
      updateStudySession(21, {
        sessionDate: '2026-10-29',
        durationMinutes: 45,
        note: null,
        completedTaskIds: [],
      }),
    ).resolves.toEqual(session);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/api/sessions/21');
    expect(init.method).toBe('PUT');
    if (typeof init.body !== 'string') throw new Error('Expected JSON request body');
    expect(JSON.parse(init.body) as unknown).toEqual({
      sessionDate: '2026-10-29',
      durationMinutes: 45,
      note: null,
      completedTaskIds: [],
    });

    fetchMock.mockResolvedValueOnce(json({ ...session, topicId: 0 }));
    await expect(
      updateStudySession(21, {
        sessionDate: '2026-10-29',
        durationMinutes: 45,
        note: null,
        completedTaskIds: [],
      }),
    ).rejects.toMatchObject({ name: 'ResponseFormatError' });
  });

  it('uses exact bodyless DELETE with Bearer and accepts only empty 204', async () => {
    authSession.start('session-delete-token');
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(deleteStudySession(21)).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/api/sessions/21');
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer session-delete-token');

    fetchMock.mockResolvedValueOnce(json({ deleted: true }, 200));
    await expect(deleteStudySession(21)).rejects.toMatchObject({ name: 'ResponseFormatError' });
    await expect(deleteStudySession(0)).rejects.toMatchObject({ name: 'ResponseFormatError' });
  });

  it('opens an accessible confirmation dialog without deleting and restores focus on cancel', async () => {
    const view = await signInAndOpenSession(fetchMock);
    const deleteButton = screen.getByRole('button', { name: 'Delete study session' });
    await view.user.click(deleteButton);

    const dialog = screen.getByRole('dialog', { name: 'Delete study session?' });
    expect(within(dialog).getByText(/29\.10\.2026/)).toBeVisible();
    expect(within(dialog).getByText(/45 minutes/)).toBeVisible();
    expect(within(dialog).getByText(/manually completed tasks remain completed/i)).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(requestsFor(fetchMock, '/api/sessions/21', 'DELETE')).toHaveLength(0);

    await view.user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(deleteButton).toHaveFocus());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('deletes after confirmation, navigates to Topic and performs deterministic cache cleanup', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(studySessionQueryKeys.list(42, 7), [session]);
    queryClient.setQueryData(dashboardQueryKeys.summary(42), { totalStudyMinutes: 45 });
    const activityKey = dashboardQueryKeys.activity(42, {
      from: '2026-10-01',
      to: '2026-10-30',
    });
    queryClient.setQueryData(activityKey, { days: [] });
    queryClient.setQueryData(learningTaskQueryKeys.detail(42, 11), firstTask);
    queryClient.setQueryData(studySessionQueryKeys.detail(99, 21), {
      ...session,
      note: 'Other account',
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const view = await signInAndOpenSession(fetchMock, undefined, queryClient);

    await view.user.click(screen.getByRole('button', { name: 'Delete study session' }));
    await view.user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Study session deleted successfully.')).toBeVisible();
    expect(requestsFor(fetchMock, '/api/sessions/21', 'DELETE')).toHaveLength(1);
    await waitFor(() =>
      expect(queryClient.getQueryData(studySessionQueryKeys.detail(42, 21))).toBeUndefined(),
    );
    expect(queryClient.getQueryData(studySessionQueryKeys.detail(99, 21))).toEqual({
      ...session,
      note: 'Other account',
    });
    expect(queryClient.getQueryState(dashboardQueryKeys.summary(42))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(activityKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(learningTaskQueryKeys.detail(42, 11))?.isInvalidated).toBe(
      true,
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: learningTaskQueryKeys.list(42, 7) }),
    );
    expect(
      screen.queryByRole('link', { name: 'View study session on 29.10.2026' }),
    ).not.toBeInTheDocument();
  });

  it('blocks duplicate DELETE while pending', async () => {
    let resolveDelete: ((response: Response) => void) | undefined;
    const view = await signInAndOpenSession(fetchMock, {
      delete: () =>
        new Promise<Response>((resolve) => {
          resolveDelete = resolve;
        }),
    });
    await view.user.click(screen.getByRole('button', { name: 'Delete study session' }));
    await view.user.click(screen.getByRole('button', { name: 'Delete' }));
    const pending = await screen.findByRole('button', { name: 'Deleting…' });
    expect(pending).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await view.user.click(pending);
    expect(requestsFor(fetchMock, '/api/sessions/21', 'DELETE')).toHaveLength(1);
    resolveDelete?.(new Response(null, { status: 204 }));
    expect(await screen.findByText('Study session deleted successfully.')).toBeVisible();
  });

  it.each([
    [400, 'Invalid value for parameter id'],
    [409, 'Operation conflicts with the current data state'],
    [500, 'An unexpected server error occurred'],
  ])(
    'shows the real generic HTTP %s delete error without invented business rules',
    async (status, message) => {
      const view = await signInAndOpenSession(fetchMock, {
        delete: () => Promise.resolve(json(apiError(status, message), status)),
      });
      await view.user.click(screen.getByRole('button', { name: 'Delete study session' }));
      await view.user.click(screen.getByRole('button', { name: 'Delete' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(screen.getByRole('heading', { name: 'Study session', level: 1 })).toBeVisible();
    },
  );

  it('handles owner-scoped 404 and offers a safe return to the verified Topic', async () => {
    const view = await signInAndOpenSession(fetchMock, {
      delete: () =>
        Promise.resolve(json(apiError(404, 'Study session with id 21 was not found'), 404)),
    });
    await view.user.click(screen.getByRole('button', { name: 'Delete study session' }));
    await view.user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/already absent/i);
    await view.user.click(screen.getByRole('button', { name: 'Back to Topic' }));
    expect(await screen.findByRole('heading', { name: topic.title })).toBeVisible();
  });

  it('treats a network failure as ambiguous and rechecks with GET without retrying DELETE', async () => {
    const view = await signInAndOpenSession(fetchMock, {
      delete: () => Promise.reject(new TypeError('Failed to fetch')),
    });
    await view.user.click(screen.getByRole('button', { name: 'Delete study session' }));
    await view.user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot confirm whether/i);
    await view.user.click(screen.getByRole('button', { name: 'Check session state' }));
    await waitFor(() => expect(requestsFor(fetchMock, '/api/sessions/21', 'GET')).toHaveLength(2));
    expect(requestsFor(fetchMock, '/api/sessions/21', 'DELETE')).toHaveLength(1);
  });

  it('uses global logout for DELETE 401 and rejects a stale success after logout', async () => {
    const queryClient = createTestQueryClient();
    const view = await signInAndOpenSession(
      fetchMock,
      { delete: () => Promise.resolve(json(apiError(401, 'Token expired'), 401)) },
      queryClient,
    );
    await view.user.click(screen.getByRole('button', { name: 'Delete study session' }));
    await view.user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('heading', { name: /sign in to codeprogress/i })).toBeVisible();
    expect(authSession.getAccessToken()).toBeNull();
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0));
  });

  it('does not apply a delayed DELETE response after the session changes', async () => {
    let resolveDelete: ((response: Response) => void) | undefined;
    const queryClient = createTestQueryClient();
    const view = await signInAndOpenSession(
      fetchMock,
      {
        delete: () =>
          new Promise<Response>((resolve) => {
            resolveDelete = resolve;
          }),
      },
      queryClient,
    );
    await view.user.click(screen.getByRole('button', { name: 'Delete study session' }));
    await view.user.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByRole('button', { name: 'Deleting…' });
    await view.user.click(screen.getByRole('button', { name: 'Logout' }));
    resolveDelete?.(new Response(null, { status: 204 }));
    await screen.findByRole('heading', { name: /sign in to codeprogress/i });
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0));
  });

  it('supports Escape and traps keyboard focus inside the delete dialog', async () => {
    const view = await signInAndOpenSession(fetchMock);
    const trigger = screen.getByRole('button', { name: 'Delete study session' });
    await view.user.click(trigger);
    const dialog = screen.getByRole('dialog');
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    const confirm = within(dialog).getByRole('button', { name: 'Delete' });
    cancel.focus();
    await view.user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(confirm).toHaveFocus();
    await view.user.keyboard('{Tab}');
    expect(cancel).toHaveFocus();
    await view.user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
