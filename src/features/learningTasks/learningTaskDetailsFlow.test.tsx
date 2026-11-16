import { screen, waitFor, within } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import type { Mock } from 'vitest';
import { authSession } from '../auth/model/authSession';
import { dashboardQueryKeys } from '../dashboard/model/dashboardQueries';
import {
  getLearningTask,
  updateLearningTask,
  updateLearningTaskPlanning,
  updateLearningTaskStatus,
  type LearningTaskResponse,
} from './api/learningTasksApi';
import { learningTaskQueryKeys } from './model/learningTaskQueries';
import { createTestQueryClient, renderApp } from '../../test/renderApp';

const user = {
  id: 42,
  email: 'details@example.com',
  createdAt: '2026-10-28T10:00:00',
  updatedAt: '2026-10-28T10:00:00',
};
const topic = {
  id: 7,
  title: 'Java concurrency',
  description: null,
  status: 'PLANNED',
  createdAt: '2026-10-27T10:00:00',
  updatedAt: '2026-10-28T10:00:00',
};
const task: LearningTaskResponse = {
  id: 11,
  topicId: 7,
  title: 'Implement executor',
  description: 'Compare thread pools',
  difficulty: 'MEDIUM',
  status: 'PLANNED',
  deadline: '2026-11-10',
  priority: 'HIGH',
  createdAt: '2026-10-28T10:15:00',
  updatedAt: '2026-10-28T10:15:00',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function error(
  status: number,
  message: string,
  path: string,
  fieldErrors: Array<{ field: string; message: string }> = [],
) {
  return {
    timestamp: '2026-10-28T10:00:00',
    status,
    error: status === 404 ? 'Not Found' : status === 401 ? 'Unauthorized' : 'Bad Request',
    message,
    path,
    fieldErrors,
  };
}

type Handlers = Partial<
  Record<'get' | 'put' | 'status' | 'planning', (body?: unknown) => Promise<Response>>
>;

function parseBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== 'string') throw new Error('Expected a JSON request body');
  return JSON.parse(body) as unknown;
}

function requestPath(input: URL | RequestInfo) {
  return input instanceof URL
    ? input.pathname
    : new URL(typeof input === 'string' ? input : input.url, window.location.origin).pathname;
}

function installMock(fetchMock: Mock<typeof fetch>, handlers: Handlers = {}) {
  fetchMock.mockImplementation((input, init) => {
    const url =
      input instanceof URL
        ? input
        : new URL(typeof input === 'string' ? input : input.url, window.location.origin);
    if (url.pathname === '/api/auth/login')
      return Promise.resolve(
        json({ accessToken: 'task-details-token', tokenType: 'Bearer', expiresIn: 3600 }),
      );
    if (url.pathname === '/api/users/me') return Promise.resolve(json(user));
    if (url.pathname === '/api/topics') return Promise.resolve(json([topic]));
    if (url.pathname === '/api/tasks/11' && init?.method === 'PUT')
      return (
        handlers.put?.(parseBody(init.body)) ??
        Promise.resolve(json({ ...task, title: 'Updated task' }))
      );
    if (url.pathname === '/api/tasks/11/status')
      return (
        handlers.status?.(parseBody(init?.body)) ??
        Promise.resolve(json({ ...task, status: 'COMPLETED' }))
      );
    if (url.pathname === '/api/tasks/11/planning')
      return (
        handlers.planning?.(parseBody(init?.body)) ??
        Promise.resolve(json({ ...task, deadline: null, priority: 'LOW' }))
      );
    if (url.pathname === '/api/tasks/11') return handlers.get?.() ?? Promise.resolve(json(task));
    if (url.pathname === '/api/topics/7') return Promise.resolve(json(topic));
    if (url.pathname === '/api/topics/7/tasks') return Promise.resolve(json([task]));
    if (url.pathname === '/api/topics/7/sessions') return Promise.resolve(json([]));
    throw new Error(`Unexpected request: ${url.pathname}`);
  });
}

async function loginAtTask(
  fetchMock: Mock<typeof fetch>,
  handlers?: Handlers,
  queryClient?: QueryClient,
) {
  installMock(fetchMock, handlers);
  const view = renderApp('/app/tasks/11', queryClient);
  await view.user.type(screen.getByLabelText('Email'), user.email);
  await view.user.type(screen.getByLabelText('Password'), 'synthetic-password');
  await view.user.click(screen.getByRole('button', { name: 'Sign in' }));
  return view;
}

describe('LearningTask details, update, status and planning', () => {
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

  it('uses the exact protected endpoints, methods, bodies, statuses and AbortSignal', async () => {
    authSession.start('api-token');
    fetchMock
      .mockResolvedValueOnce(json(task))
      .mockResolvedValueOnce(json({ ...task, title: 'Updated' }))
      .mockResolvedValueOnce(json({ ...task, status: 'IN_PROGRESS' }))
      .mockResolvedValueOnce(json({ ...task, deadline: null, priority: 'LOW' }));
    const controller = new AbortController();
    await getLearningTask(11, controller.signal);
    await updateLearningTask(11, { title: 'Updated', description: null, difficulty: 'HARD' });
    await updateLearningTaskStatus(11, { status: 'IN_PROGRESS' });
    await updateLearningTaskPlanning(11, { deadline: null, priority: 'LOW' });
    expect(
      fetchMock.mock.calls.map(([url, init]): [string, string | undefined, unknown] => [
        requestPath(url),
        init?.method,
        typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
      ]),
    ).toEqual([
      ['/api/tasks/11', 'GET', undefined],
      ['/api/tasks/11', 'PUT', { title: 'Updated', description: null, difficulty: 'HARD' }],
      ['/api/tasks/11/status', 'PATCH', { status: 'IN_PROGRESS' }],
      ['/api/tasks/11/planning', 'PATCH', { deadline: null, priority: 'LOW' }],
    ]);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    for (const [, init] of fetchMock.mock.calls)
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer api-token');
  });

  it('rejects malformed GET and mutation responses at runtime', async () => {
    authSession.start('api-token');
    fetchMock
      .mockResolvedValueOnce(json({ ...task, topicId: 0 }))
      .mockResolvedValueOnce(json({ ...task, priority: 'URGENT' }));
    await expect(getLearningTask(11)).rejects.toMatchObject({ name: 'ResponseFormatError' });
    await expect(
      updateLearningTaskPlanning(11, { deadline: null, priority: 'LOW' }),
    ).rejects.toMatchObject({ name: 'ResponseFormatError' });
  });

  it('protects the route and validates the task id before requesting data', () => {
    const first = renderApp('/app/tasks/11');
    expect(screen.getByRole('heading', { name: /sign in to codeprogress/i })).toBeVisible();
    first.unmount();
    authSession.clear();
    renderApp('/app/tasks/not-a-number');
    expect(screen.getByRole('heading', { name: /sign in to codeprogress/i })).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders full details and links back using the verified response topicId', async () => {
    await loginAtTask(fetchMock);
    expect(await screen.findByRole('heading', { name: task.title })).toBeVisible();
    expect(screen.getByText(task.description ?? '')).toBeVisible();
    expect(screen.getByText('Medium')).toBeVisible();
    expect(screen.getByText('High')).toBeVisible();
    expect(screen.getByText('10.11.2026')).toBeVisible();
    expect(screen.getByRole('link', { name: /back to topic/i })).toHaveAttribute(
      'href',
      '/app/topics/7',
    );
  });

  it('shows loading, 404 and retryable error states', async () => {
    let attempts = 0;
    const view = await loginAtTask(fetchMock, {
      get: () => {
        attempts += 1;
        return attempts === 1
          ? Promise.resolve(json(error(500, 'Failure', '/api/tasks/11'), 500))
          : Promise.resolve(json(task));
      },
    });
    expect(
      await screen.findByRole('heading', { name: 'Learning task details are unavailable' }),
    ).toBeVisible();
    await view.user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: task.title })).toBeVisible();
    view.unmount();
    authSession.clear();
    await loginAtTask(fetchMock, {
      get: () => Promise.resolve(json(error(404, 'Not found', '/api/tasks/11'), 404)),
    });
    expect(
      await screen.findByRole('heading', { name: 'This learning task is unavailable' }),
    ).toBeVisible();
  });

  it('updates exact details and synchronizes detail and Topic list caches', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(learningTaskQueryKeys.list(42, 7), [task]);
    const put = vi.fn<(body?: unknown) => Promise<Response>>((body) =>
      Promise.resolve(json({ ...task, ...(body as object), updatedAt: '2026-10-28T11:00:00' })),
    );
    const view = await loginAtTask(fetchMock, { put }, queryClient);
    await screen.findByRole('heading', { name: task.title });
    await view.user.click(screen.getByRole('button', { name: 'Task actions' }));
    await view.user.click(screen.getByRole('menuitem', { name: 'Edit details' }));
    const form = screen.getByRole('heading', { name: 'Update learning task' }).parentElement;
    if (!form) throw new Error('Missing edit form');
    const title = within(form).getByLabelText('Title');
    await view.user.clear(title);
    await view.user.type(title, 'Updated task');
    await view.user.selectOptions(within(form).getByLabelText('Difficulty'), 'HARD');
    await view.user.click(within(form).getByRole('button', { name: 'Save details' }));
    expect(await screen.findByRole('heading', { name: 'Updated task' })).toBeVisible();
    expect(put).toHaveBeenCalledWith({
      title: 'Updated task',
      description: task.description,
      difficulty: 'HARD',
    });
    expect(
      queryClient.getQueryData<LearningTaskResponse[]>(learningTaskQueryKeys.list(42, 7))?.[0]
        ?.title,
    ).toBe('Updated task');
  });

  it('maps backend update validation and prevents duplicate submission', async () => {
    let resolvePut: ((response: Response) => void) | undefined;
    const put = vi.fn<(body?: unknown) => Promise<Response>>(
      () =>
        new Promise((resolve) => {
          resolvePut = resolve;
        }),
    );
    const view = await loginAtTask(fetchMock, { put });
    await screen.findByRole('heading', { name: task.title });
    await view.user.click(screen.getByRole('button', { name: 'Task actions' }));
    await view.user.click(screen.getByRole('menuitem', { name: 'Edit details' }));
    await view.user.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(put).toHaveBeenCalledTimes(1);
    resolvePut?.(
      json(
        error(400, 'Invalid', '/api/tasks/11', [{ field: 'title', message: 'Rejected title' }]),
        400,
      ),
    );
    expect(await screen.findByText('Rejected title')).toBeVisible();
  });

  it('changes status, refreshes Dashboard summary, and leaves activity untouched', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(dashboardQueryKeys.summary(42), { totalTasks: 1 });
    const activityKey = dashboardQueryKeys.activity(42, { from: '2026-10-01', to: '2026-10-28' });
    queryClient.setQueryData(activityKey, { days: [] });
    const status = vi.fn<(body?: unknown) => Promise<Response>>(() =>
      Promise.resolve(json({ ...task, status: 'COMPLETED' })),
    );
    const view = await loginAtTask(fetchMock, { status }, queryClient);
    await screen.findByRole('heading', { name: task.title });
    await view.user.click(screen.getByRole('button', { name: 'Task actions' }));
    await view.user.click(screen.getByRole('menuitem', { name: 'Change status' }));
    const select = screen.getByLabelText<HTMLSelectElement>('Status');
    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      'PLANNED',
      'IN_PROGRESS',
      'COMPLETED',
    ]);
    await view.user.selectOptions(select, 'COMPLETED');
    await view.user.click(screen.getByRole('button', { name: 'Change status' }));
    expect(await screen.findByText('Learning task status changed.')).toBeVisible();
    expect(status).toHaveBeenCalledWith({ status: 'COMPLETED' });
    expect(queryClient.getQueryState(dashboardQueryKeys.summary(42))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(activityKey)?.isInvalidated).toBe(false);
  });

  it('updates planning and explicitly clears deadline without Dashboard invalidation', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(dashboardQueryKeys.summary(42), { totalTasks: 1 });
    const planning = vi.fn<(body?: unknown) => Promise<Response>>(() =>
      Promise.resolve(json({ ...task, deadline: null, priority: 'LOW' })),
    );
    const view = await loginAtTask(fetchMock, { planning }, queryClient);
    await screen.findByRole('heading', { name: task.title });
    await view.user.click(screen.getByRole('button', { name: 'Task actions' }));
    await view.user.click(screen.getByRole('menuitem', { name: 'Edit planning' }));
    const deadline = screen.getByLabelText('Deadline (optional)');
    await view.user.clear(deadline);
    await view.user.selectOptions(screen.getByLabelText('Priority'), 'LOW');
    await view.user.click(screen.getByRole('button', { name: 'Save planning' }));
    expect(await screen.findByText('No deadline')).toBeVisible();
    expect(planning).toHaveBeenCalledWith({ deadline: null, priority: 'LOW' });
    expect(queryClient.getQueryState(dashboardQueryKeys.summary(42))?.isInvalidated).toBe(false);
  });

  it('logs out and clears all caches after a protected 401', async () => {
    const queryClient = createTestQueryClient();
    await loginAtTask(
      fetchMock,
      { get: () => Promise.resolve(json(error(401, 'Unauthorized', '/api/tasks/11'), 401)) },
      queryClient,
    );
    expect(await screen.findByRole('heading', { name: /sign in to codeprogress/i })).toBeVisible();
    expect(authSession.getAccessToken()).toBeNull();
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0));
  });

  it('isolates detail caches by user and ignores a mutation completed after logout', async () => {
    let resolveStatus: ((response: Response) => void) | undefined;
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(learningTaskQueryKeys.detail(99, 11), {
      ...task,
      title: 'Other user task',
    });
    const view = await loginAtTask(
      fetchMock,
      {
        status: () =>
          new Promise((resolve) => {
            resolveStatus = resolve;
          }),
      },
      queryClient,
    );
    await screen.findByRole('heading', { name: task.title });
    expect(screen.queryByText('Other user task')).not.toBeInTheDocument();
    await view.user.click(screen.getByRole('button', { name: 'Task actions' }));
    await view.user.click(screen.getByRole('menuitem', { name: 'Change status' }));
    await view.user.selectOptions(screen.getByLabelText('Status'), 'COMPLETED');
    await view.user.click(screen.getByRole('button', { name: 'Change status' }));
    await view.user.click(screen.getByRole('button', { name: 'Logout' }));
    resolveStatus?.(json({ ...task, status: 'COMPLETED' }));
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0));
  });

  it('supports keyboard access to all action forms', async () => {
    const view = await loginAtTask(fetchMock);
    await screen.findByRole('heading', { name: task.title });
    const actions = screen.getByRole('button', { name: 'Task actions' });
    actions.focus();
    await view.user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByLabelText('Title')).toHaveFocus();
    await view.user.click(screen.getByRole('button', { name: 'Cancel' }));
    actions.focus();
    await view.user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');
    expect(screen.getByLabelText('Deadline (optional)')).toHaveFocus();
  });
});
