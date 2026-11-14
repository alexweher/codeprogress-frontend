import { screen, waitFor, within } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import type { Mock } from 'vitest';
import { authSession } from '../auth/model/authSession';
import { dashboardQueryKeys } from '../dashboard/model/dashboardQueries';
import {
  createLearningTask,
  getLearningTasks,
  type LearningTaskResponse,
} from './api/learningTasksApi';
import { learningTaskQueryKeys } from './model/learningTaskQueries';
import { createTestQueryClient, renderApp } from '../../test/renderApp';

const loginResponse = {
  accessToken: 'learning-tasks-test-token',
  tokenType: 'Bearer',
  expiresIn: 3600,
};

const currentUser = {
  id: 42,
  email: 'tasks@example.com',
  createdAt: '2026-10-28T10:00:00',
  updatedAt: '2026-10-28T10:00:00',
};

const topic = {
  id: 7,
  title: 'Java concurrency',
  description: 'Threads, executors and synchronization',
  status: 'PLANNED',
  createdAt: '2026-10-27T10:00:00',
  updatedAt: '2026-10-28T10:00:00',
} as const;

const task: LearningTaskResponse = {
  id: 11,
  topicId: 7,
  title: 'Implement an executor example',
  description: 'Compare fixed and cached thread pools',
  difficulty: 'MEDIUM',
  status: 'PLANNED',
  deadline: '2026-11-10',
  priority: 'HIGH',
  createdAt: '2026-10-28T10:15:00',
  updatedAt: '2026-10-28T10:15:00',
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
  path: string,
  fieldErrors: Array<{ field: string; message: string }> = [],
) {
  return {
    timestamp: '2026-10-28T10:00:00',
    status,
    error: status === 401 ? 'Unauthorized' : 'Bad Request',
    message,
    path,
    fieldErrors,
  };
}

type TaskHandlers = {
  get?: () => Promise<Response>;
  post?: (body: unknown) => Promise<Response>;
};

function installApiMock(fetchMock: Mock<typeof fetch>, handlers: TaskHandlers = {}) {
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
    if (url.pathname === '/api/topics/7/tasks' && init?.method === 'POST') {
      const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : null;
      return handlers.post?.(body) ?? Promise.resolve(jsonResponse(task, 201));
    }
    if (url.pathname === '/api/topics/7/tasks') {
      return handlers.get?.() ?? Promise.resolve(jsonResponse([task]));
    }
    if (url.pathname === '/api/topics/7/sessions') {
      return Promise.resolve(jsonResponse([]));
    }
    if (url.pathname === '/api/topics/7') {
      return Promise.resolve(jsonResponse(topic));
    }

    throw new Error(`Unexpected request: ${url.pathname}`);
  });
}

async function signInAndOpenTopic(
  fetchMock: Mock<typeof fetch>,
  handlers?: TaskHandlers,
  queryClient?: QueryClient,
  waitForDetails = true,
) {
  installApiMock(fetchMock, handlers);
  const view = renderApp('/app/topics/7', queryClient);
  await view.user.type(screen.getByLabelText('Email'), 'tasks@example.com');
  await view.user.type(screen.getByLabelText('Password'), 'not-a-real-password');
  await view.user.click(screen.getByRole('button', { name: 'Sign in' }));
  if (waitForDetails) {
    await screen.findByRole('heading', { name: topic.title });
  }
  return view;
}

function taskRequests(fetchMock: Mock<typeof fetch>, method?: string) {
  return fetchMock.mock.calls.filter(([input, init]) => {
    const url =
      input instanceof URL
        ? input
        : new URL(typeof input === 'string' ? input : input.url, window.location.origin);
    return url.pathname === '/api/topics/7/tasks' && (method ? init?.method === method : true);
  });
}

describe('LearningTasks list and create flow', () => {
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

  it('gets the unpaginated task list for the exact Topic ID with bearer auth and AbortSignal', async () => {
    authSession.start('tasks-api-token');
    fetchMock.mockResolvedValueOnce(jsonResponse([task]));
    const controller = new AbortController();

    await expect(getLearningTasks(7, controller.signal)).resolves.toEqual([task]);

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/api/topics/7/tasks');
    expect(init.method).toBe('GET');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tasks-api-token');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('creates a task with the exact verified body and permits omitted deadline and priority', async () => {
    authSession.start('tasks-api-token');
    const response = { ...task, deadline: null, priority: 'MEDIUM' as const };
    fetchMock.mockResolvedValueOnce(jsonResponse(response, 201));

    await expect(
      createLearningTask(7, {
        title: task.title,
        description: null,
        difficulty: 'MEDIUM',
      }),
    ).resolves.toEqual(response);

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/api/topics/7/tasks');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tasks-api-token');
    if (typeof init.body !== 'string') {
      throw new Error('Expected the create-learning-task request body to be JSON');
    }
    expect(JSON.parse(init.body) as unknown).toEqual({
      title: task.title,
      description: null,
      difficulty: 'MEDIUM',
    });
  });

  it('rejects malformed list and create responses at runtime', async () => {
    authSession.start('tasks-api-token');
    fetchMock
      .mockResolvedValueOnce(jsonResponse([{ ...task, topicId: 8 }]))
      .mockResolvedValueOnce(jsonResponse({ ...task, deadline: '2026-02-31' }, 201));

    await expect(getLearningTasks(7)).rejects.toMatchObject({ name: 'ResponseFormatError' });
    await expect(
      createLearningTask(7, { title: task.title, difficulty: 'EASY' }),
    ).rejects.toMatchObject({ name: 'ResponseFormatError' });
  });

  it('renders verified fields, text labels and an explicit no-deadline value', async () => {
    await signInAndOpenTopic(fetchMock, {
      get: () =>
        Promise.resolve(
          jsonResponse([
            task,
            {
              ...task,
              id: 12,
              title: 'Read documentation',
              description: null,
              difficulty: 'EASY',
              status: 'IN_PROGRESS',
              deadline: null,
              priority: 'LOW',
            },
            {
              ...task,
              id: 13,
              title: 'Review implementation',
              description: 'Review concurrency decisions',
              difficulty: 'HARD',
              status: 'COMPLETED',
              deadline: '2026-12-01',
              priority: 'MEDIUM',
            },
          ]),
        ),
    });

    const list = await screen.findByRole('list', { name: 'Learning tasks' });
    expect(within(list).getByText(task.title)).toBeVisible();
    expect(within(list).getByText('Compare fixed and cached thread pools')).toBeVisible();
    expect(within(list).getByText('10.11.2026')).toBeVisible();
    expect(within(list).getByText('No deadline')).toBeVisible();
    expect(within(list).getByText('In progress')).toBeVisible();
    expect(within(list).getByText('Completed')).toBeVisible();
    expect(within(list).getByText('Hard')).toBeVisible();
  });

  it('shows loading and empty task states without pagination controls', async () => {
    const pending = await signInAndOpenTopic(fetchMock, {
      get: () => new Promise<Response>(() => undefined),
    });
    expect(await screen.findByText('Loading learning tasks…')).toBeVisible();
    expect(screen.queryByRole('button', { name: /next page/i })).not.toBeInTheDocument();
    pending.unmount();
    authSession.clear();

    const empty = await signInAndOpenTopic(fetchMock, {
      get: () => Promise.resolve(jsonResponse([])),
    });
    expect(await screen.findByRole('heading', { name: 'No learning tasks yet' })).toBeVisible();
    empty.unmount();
  });

  it('shows an HTTP error and retries the task list', async () => {
    let attempts = 0;
    const { user } = await signInAndOpenTopic(fetchMock, {
      get: () => {
        attempts += 1;
        return Promise.resolve(
          attempts === 1
            ? jsonResponse(apiError(500, 'Server error', '/api/topics/7/tasks'), 500)
            : jsonResponse([task]),
        );
      },
    });

    expect(
      await screen.findByRole('heading', { name: 'Learning tasks are unavailable' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Retry tasks' }));
    expect(await screen.findByText(task.title)).toBeVisible();
    expect(attempts).toBe(2);
  });

  it('requires difficulty and exposes only verified difficulty and priority enums', async () => {
    const { user } = await signInAndOpenTopic(fetchMock, {
      get: () => Promise.resolve(jsonResponse([])),
    });
    await screen.findByRole('heading', { name: 'No learning tasks yet' });
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    await user.type(screen.getByLabelText('Title'), 'Task without difficulty');

    const difficulty = screen.getByLabelText<HTMLSelectElement>('Difficulty');
    const priority = screen.getByLabelText<HTMLSelectElement>('Priority (optional)');
    expect(Array.from(difficulty.options).map((option) => option.value)).toEqual([
      '',
      'EASY',
      'MEDIUM',
      'HARD',
    ]);
    expect(Array.from(priority.options).map((option) => option.value)).toEqual([
      '',
      'LOW',
      'MEDIUM',
      'HIGH',
    ]);

    const callsBefore = taskRequests(fetchMock, 'POST').length;
    await user.click(screen.getByRole('button', { name: 'Create task' }));
    expect(screen.getByText('Choose a difficulty.')).toBeVisible();
    expect(taskRequests(fetchMock, 'POST')).toHaveLength(callsBefore);
  });

  it('creates from the form, closes it, updates the list and invalidates only Dashboard summary', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(dashboardQueryKeys.summary(42), { totalTopics: 1, plannedTasks: 0 });
    const activityKey = dashboardQueryKeys.activity(42, {
      from: '2026-10-01',
      to: '2026-10-28',
    });
    queryClient.setQueryData(activityKey, { days: [] });
    const postSpy = vi.fn<(body: unknown) => Promise<Response>>(() =>
      Promise.resolve(jsonResponse({ ...task, deadline: null, priority: 'MEDIUM' }, 201)),
    );
    const { user } = await signInAndOpenTopic(
      fetchMock,
      { get: () => Promise.resolve(jsonResponse([])), post: postSpy },
      queryClient,
    );
    await screen.findByRole('heading', { name: 'No learning tasks yet' });
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    await user.type(screen.getByLabelText('Title'), task.title);
    await user.selectOptions(screen.getByLabelText('Difficulty'), 'MEDIUM');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    expect(await screen.findByText(task.title)).toBeVisible();
    expect(screen.getByText('Learning task created.')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Create learning task' })).not.toBeInTheDocument();
    expect(postSpy).toHaveBeenCalledWith({
      title: task.title,
      description: null,
      difficulty: 'MEDIUM',
    });
    expect(queryClient.getQueryData(learningTaskQueryKeys.list(42, 7))).toEqual([
      expect.objectContaining({ id: task.id, priority: 'MEDIUM', deadline: null }),
    ]);
    expect(queryClient.getQueryState(learningTaskQueryKeys.list(42, 7))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(dashboardQueryKeys.summary(42))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(activityKey)?.isInvalidated).toBe(false);
  });

  it('sends optional deadline and priority exactly when selected', async () => {
    const postSpy = vi.fn<(body: unknown) => Promise<Response>>(() =>
      Promise.resolve(jsonResponse(task, 201)),
    );
    const { user } = await signInAndOpenTopic(fetchMock, {
      get: () => Promise.resolve(jsonResponse([])),
      post: postSpy,
    });
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    await user.type(screen.getByLabelText('Title'), task.title);
    await user.type(screen.getByLabelText('Description (optional)'), task.description ?? '');
    await user.selectOptions(screen.getByLabelText('Difficulty'), 'MEDIUM');
    await user.type(screen.getByLabelText('Deadline (optional)'), '2026-11-10');
    await user.selectOptions(screen.getByLabelText('Priority (optional)'), 'HIGH');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await screen.findByText('Learning task created.');
    expect(postSpy).toHaveBeenCalledWith({
      title: task.title,
      description: task.description,
      difficulty: 'MEDIUM',
      deadline: '2026-11-10',
      priority: 'HIGH',
    });
  });

  it('maps backend fieldErrors and keeps the create form open', async () => {
    const { user } = await signInAndOpenTopic(fetchMock, {
      get: () => Promise.resolve(jsonResponse([])),
      post: () =>
        Promise.resolve(
          jsonResponse(
            apiError(400, 'Request validation failed', '/api/topics/7/tasks', [
              { field: 'title', message: 'Title is not accepted' },
              { field: 'difficulty', message: 'Difficulty is not accepted' },
            ]),
            400,
          ),
        ),
    });
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    await user.type(screen.getByLabelText('Title'), 'Rejected task');
    await user.selectOptions(screen.getByLabelText('Difficulty'), 'HARD');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    expect(await screen.findByText('Title is not accepted')).toBeVisible();
    expect(screen.getByText('Difficulty is not accepted')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Create learning task' })).toBeVisible();
  });

  it('blocks duplicate submit and reports a network error', async () => {
    let rejectPost: ((reason?: unknown) => void) | undefined;
    const postSpy = vi.fn<(body: unknown) => Promise<Response>>(
      () =>
        new Promise<Response>((_resolve, reject) => {
          rejectPost = reject;
        }),
    );
    const { user } = await signInAndOpenTopic(fetchMock, {
      get: () => Promise.resolve(jsonResponse([])),
      post: postSpy,
    });
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    await user.type(screen.getByLabelText('Title'), task.title);
    await user.selectOptions(screen.getByLabelText('Difficulty'), 'MEDIUM');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    expect(await screen.findByRole('button', { name: 'Creating task…' })).toBeDisabled();
    expect(postSpy).toHaveBeenCalledTimes(1);
    rejectPost?.(new TypeError('Failed to fetch'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
    expect(postSpy).toHaveBeenCalledTimes(1);
  });

  it('protects the route and logs out with a full cache clear on task-list 401', async () => {
    const protectedView = renderApp('/app/topics/7');
    expect(screen.getByRole('heading', { name: /sign in to codeprogress/i })).toBeVisible();
    protectedView.unmount();
    authSession.clear();

    const queryClient = createTestQueryClient();
    await signInAndOpenTopic(
      fetchMock,
      {
        get: () =>
          Promise.resolve(
            jsonResponse(
              apiError(
                401,
                'Authentication is required or token is invalid',
                '/api/topics/7/tasks',
              ),
              401,
            ),
          ),
      },
      queryClient,
      false,
    );

    expect(await screen.findByRole('heading', { name: /sign in to codeprogress/i })).toBeVisible();
    expect(authSession.getAccessToken()).toBeNull();
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0));
  });

  it('isolates task caches by user and clears all user data on manual logout', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(learningTaskQueryKeys.list(99, 7), [
      { ...task, title: 'Another user private task' },
    ]);
    const { user } = await signInAndOpenTopic(fetchMock, undefined, queryClient);

    expect(await screen.findByText(task.title)).toBeVisible();
    expect(screen.queryByText('Another user private task')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0));
  });

  it('does not apply a delayed create response after the session is cleared', async () => {
    let resolvePost: ((response: Response) => void) | undefined;
    const queryClient = createTestQueryClient();
    const { user } = await signInAndOpenTopic(
      fetchMock,
      {
        get: () => Promise.resolve(jsonResponse([])),
        post: () =>
          new Promise<Response>((resolve) => {
            resolvePost = resolve;
          }),
      },
      queryClient,
    );
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    await user.type(screen.getByLabelText('Title'), task.title);
    await user.selectOptions(screen.getByLabelText('Difficulty'), 'MEDIUM');
    await user.click(screen.getByRole('button', { name: 'Create task' }));
    await screen.findByRole('button', { name: 'Creating task…' });
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    resolvePost?.(jsonResponse(task, 201));

    await screen.findByRole('heading', { name: /sign in to codeprogress/i });
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0));
  });

  it('supports keyboard navigation through the create fields', async () => {
    const { user } = await signInAndOpenTopic(fetchMock, {
      get: () => Promise.resolve(jsonResponse([])),
    });
    const addButton = screen.getByRole('button', { name: 'Add task' });
    addButton.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByLabelText('Title')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Description (optional)')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Difficulty')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Deadline (optional)')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Priority (optional)')).toHaveFocus();
  });
});
