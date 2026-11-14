import { screen, waitFor, within } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import type { Mock } from 'vitest';
import { authSession } from '../auth/model/authSession';
import { dashboardQueryKeys } from '../dashboard/model/dashboardQueries';
import { deleteLearningTask, type LearningTaskResponse } from './api/learningTasksApi';
import { learningTaskQueryKeys } from './model/learningTaskQueries';
import { createTestQueryClient, renderApp } from '../../test/renderApp';

const currentUser = {
  id: 42,
  email: 'delete-task@example.com',
  createdAt: '2026-10-29T10:00:00',
  updatedAt: '2026-10-29T10:00:00',
};
const topic = {
  id: 7,
  title: 'Safe task deletion',
  description: null,
  status: 'IN_PROGRESS',
  createdAt: '2026-10-28T10:00:00',
  updatedAt: '2026-10-29T10:00:00',
};
const task: LearningTaskResponse = {
  id: 11,
  topicId: 7,
  title: 'Disposable learning task',
  description: 'Mock-only deletion target',
  difficulty: 'MEDIUM',
  status: 'PLANNED',
  deadline: null,
  priority: 'HIGH',
  createdAt: '2026-10-29T10:15:00',
  updatedAt: '2026-10-29T10:15:00',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function apiError(status: number, message: string) {
  return {
    timestamp: '2026-10-29T10:00:00',
    status,
    error: status === 401 ? 'Unauthorized' : status === 404 ? 'Not Found' : 'Conflict',
    message,
    path: '/api/tasks/11',
    fieldErrors: [],
  };
}

type DeleteHandlers = {
  get?: () => Promise<Response>;
  list?: () => Promise<Response>;
  delete?: () => Promise<Response>;
};

function installApiMock(fetchMock: Mock<typeof fetch>, handlers: DeleteHandlers = {}) {
  fetchMock.mockImplementation((input, init) => {
    const url =
      input instanceof URL
        ? input
        : new URL(typeof input === 'string' ? input : input.url, window.location.origin);
    if (url.pathname === '/api/auth/login')
      return Promise.resolve(
        json({ accessToken: 'delete-task-token', tokenType: 'Bearer', expiresIn: 3600 }),
      );
    if (url.pathname === '/api/users/me') return Promise.resolve(json(currentUser));
    if (url.pathname === '/api/topics') return Promise.resolve(json([topic]));
    if (url.pathname === '/api/topics/7') return Promise.resolve(json(topic));
    if (url.pathname === '/api/topics/7/tasks')
      return handlers.list?.() ?? Promise.resolve(json([task]));
    if (url.pathname === '/api/topics/7/sessions') return Promise.resolve(json([]));
    if (url.pathname === '/api/tasks/11' && init?.method === 'DELETE')
      return handlers.delete?.() ?? Promise.resolve(new Response(null, { status: 204 }));
    if (url.pathname === '/api/tasks/11') return handlers.get?.() ?? Promise.resolve(json(task));
    throw new Error(`Unexpected request: ${url.pathname}`);
  });
}

async function signInAndOpenTask(
  fetchMock: Mock<typeof fetch>,
  handlers?: DeleteHandlers,
  queryClient?: QueryClient,
) {
  installApiMock(fetchMock, handlers);
  const view = renderApp('/app/tasks/11', queryClient);
  await view.user.type(screen.getByLabelText('Email'), currentUser.email);
  await view.user.type(screen.getByLabelText('Password'), 'synthetic-password');
  await view.user.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('heading', { name: task.title });
  return view;
}

async function openDeleteDialog(user: Awaited<ReturnType<typeof signInAndOpenTask>>['user']) {
  await user.click(screen.getByRole('button', { name: 'Task actions' }));
  await user.click(screen.getByRole('menuitem', { name: 'Delete LearningTask' }));
}

function deleteCalls(fetchMock: Mock<typeof fetch>) {
  return fetchMock.mock.calls.filter(([input, init]) => {
    const url =
      input instanceof URL
        ? input
        : new URL(typeof input === 'string' ? input : input.url, window.location.origin);
    return url.pathname === '/api/tasks/11' && init?.method === 'DELETE';
  });
}

describe('safe LearningTask deletion', () => {
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

  it('sends exact authenticated DELETE without a body and accepts only empty HTTP 204', async () => {
    authSession.start('delete-api-token');
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(deleteLearningTask(11)).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/api/tasks/11');
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer delete-api-token');

    fetchMock.mockResolvedValueOnce(json({ deleted: true }, 200));
    await expect(deleteLearningTask(11)).rejects.toMatchObject({ name: 'ResponseFormatError' });
  });

  it('shows the action and labelled confirmation without deleting before confirmation', async () => {
    const { user } = await signInAndOpenTask(fetchMock);
    const trigger = screen.getByRole('button', { name: 'Task actions' });
    expect(trigger).toBeVisible();
    await openDeleteDialog(user);

    const dialog = screen.getByRole('dialog', { name: 'Delete LearningTask?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText(task.title)).toBeVisible();
    expect(within(dialog).getByText(/permanent and cannot be undone/i)).toBeVisible();
    expect(deleteCalls(fetchMock)).toHaveLength(0);
  });

  it('cancels without a request and restores focus to Delete LearningTask', async () => {
    const { user } = await signInAndOpenTask(fetchMock);
    const trigger = screen.getByRole('button', { name: 'Task actions' });
    await openDeleteDialog(user);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(deleteCalls(fetchMock)).toHaveLength(0);
  });

  it('deletes on confirmation, navigates, updates list/detail caches and Dashboard summary only', async () => {
    let deleted = false;
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(dashboardQueryKeys.summary(42), { plannedTasks: 1 });
    const activityKey = dashboardQueryKeys.activity(42, {
      from: '2026-10-01',
      to: '2026-10-29',
    });
    queryClient.setQueryData(activityKey, { days: [] });
    const { user } = await signInAndOpenTask(
      fetchMock,
      {
        list: () => Promise.resolve(json(deleted ? [] : [task])),
        delete: () => {
          deleted = true;
          return Promise.resolve(new Response(null, { status: 204 }));
        },
      },
      queryClient,
    );
    await openDeleteDialog(user);
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Learning task deleted successfully.')).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'No learning tasks yet' })).toBeVisible();
    await waitFor(() =>
      expect(queryClient.getQueryData(learningTaskQueryKeys.detail(42, 11))).toBeUndefined(),
    );
    expect(queryClient.getQueryData(learningTaskQueryKeys.list(42, 7))).toEqual([]);
    expect(queryClient.getQueryState(dashboardQueryKeys.summary(42))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(activityKey)?.isInvalidated).toBe(false);
  });

  it('blocks duplicate confirmation while DELETE is pending', async () => {
    let resolveDelete: ((response: Response) => void) | undefined;
    let deleted = false;
    const handler = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveDelete = (response) => {
            deleted = true;
            resolve(response);
          };
        }),
    );
    const { user } = await signInAndOpenTask(fetchMock, {
      list: () => Promise.resolve(json(deleted ? [] : [task])),
      delete: handler,
    });
    await openDeleteDialog(user);
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('button', { name: 'Deleting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(handler).toHaveBeenCalledTimes(1);
    resolveDelete?.(new Response(null, { status: 204 }));
    expect(await screen.findByText('Learning task deleted successfully.')).toBeVisible();
  });

  it('keeps task data and shows the confirmed StudySession conflict on HTTP 409', async () => {
    const queryClient = createTestQueryClient();
    const { user } = await signInAndOpenTask(
      fetchMock,
      {
        delete: () =>
          Promise.resolve(
            json(
              apiError(
                409,
                'Learning task with id 11 cannot be deleted because it is part of study session history',
              ),
              409,
            ),
          ),
      },
      queryClient,
    );
    await openDeleteDialog(user);
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/study session history/i);
    expect(screen.getByRole('heading', { name: task.title })).toBeVisible();
    expect(queryClient.getQueryData(learningTaskQueryKeys.detail(42, 11))).toEqual(task);
  });

  it('handles HTTP 404 and offers a safe return to the verified Topic', async () => {
    const { user } = await signInAndOpenTask(fetchMock, {
      delete: () => Promise.resolve(json(apiError(404, 'Learning task was not found'), 404)),
    });
    await openDeleteDialog(user);
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /already absent|no longer available/i,
    );
    await user.click(screen.getByRole('button', { name: 'Back to Topic' }));
    expect(await screen.findByRole('heading', { name: topic.title })).toBeVisible();
  });

  it('uses the existing logout lifecycle for DELETE HTTP 401', async () => {
    const queryClient = createTestQueryClient();
    const { user } = await signInAndOpenTask(
      fetchMock,
      {
        delete: () =>
          Promise.resolve(
            json(apiError(401, 'Authentication is required or token is invalid'), 401),
          ),
      },
      queryClient,
    );
    await openDeleteDialog(user);
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('heading', { name: /sign in to codeprogress/i })).toBeVisible();
    expect(authSession.getAccessToken()).toBeNull();
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0));
  });

  it('does not claim success after network failure and can re-check task state with GET', async () => {
    let detailCalls = 0;
    const { user } = await signInAndOpenTask(fetchMock, {
      get: () => {
        detailCalls += 1;
        return Promise.resolve(json(task));
      },
      delete: () => Promise.reject(new TypeError('Failed to fetch')),
    });
    await openDeleteDialog(user);
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot confirm whether/i);
    expect(screen.queryByText('Learning task deleted successfully.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Check task state' }));
    await waitFor(() => expect(detailCalls).toBe(2));
    expect(screen.getByRole('heading', { name: task.title })).toBeVisible();
  });

  it('does not apply a delayed delete result to a new session', async () => {
    let resolveDelete: ((response: Response) => void) | undefined;
    const queryClient = createTestQueryClient();
    const { user } = await signInAndOpenTask(
      fetchMock,
      {
        delete: () =>
          new Promise<Response>((resolve) => {
            resolveDelete = resolve;
          }),
      },
      queryClient,
    );
    await openDeleteDialog(user);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Logout' }));

    authSession.start('new-session-token');
    queryClient.setQueryData(learningTaskQueryKeys.list(88, 9), [
      { ...task, id: 99, topicId: 9, title: 'New session task' },
    ]);
    queryClient.setQueryData(dashboardQueryKeys.summary(88), { plannedTasks: 1 });
    resolveDelete?.(new Response(null, { status: 204 }));

    await waitFor(() =>
      expect(queryClient.getQueryData(learningTaskQueryKeys.list(88, 9))).toEqual([
        expect.objectContaining({ title: 'New session task' }),
      ]),
    );
    expect(queryClient.getQueryState(dashboardQueryKeys.summary(88))?.isInvalidated).toBe(false);
    expect(queryClient.getQueryData(learningTaskQueryKeys.list(42, 7))).toBeUndefined();
  });

  it('supports focus trapping, Escape and trigger focus restoration', async () => {
    const { user } = await signInAndOpenTask(fetchMock);
    const trigger = screen.getByRole('button', { name: 'Task actions' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    await user.keyboard('{Enter}');
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const confirm = screen.getByRole('button', { name: 'Delete' });
    expect(cancel).toHaveFocus();
    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
