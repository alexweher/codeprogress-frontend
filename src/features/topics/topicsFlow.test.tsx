import { screen, waitFor, within } from '@testing-library/react';
import type { Mock } from 'vitest';
import { authSession } from '../auth/model/authSession';
import { dashboardQueryKeys } from '../dashboard/model/dashboardQueries';
import { createTopic, getTopics } from './api/topicsApi';
import { topicQueryKeys } from './model/topicQueries';
import { createTestQueryClient, renderApp } from '../../test/renderApp';

const loginResponse = {
  accessToken: 'topics-test-token',
  tokenType: 'Bearer',
  expiresIn: 3600,
};

const currentUser = {
  id: 42,
  email: 'topics@example.com',
  createdAt: '2026-10-26T10:00:00',
  updatedAt: '2026-10-26T10:00:00',
};

const topic = {
  id: 7,
  title: 'Java concurrency',
  description: 'Threads, executors and synchronization',
  status: 'PLANNED',
  createdAt: '2026-10-26T10:00:00',
  updatedAt: '2026-10-26T10:00:00',
} as const;

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
    timestamp: '2026-10-26T10:00:00',
    status,
    error: status === 401 ? 'Unauthorized' : 'Bad Request',
    message,
    path,
    fieldErrors,
  };
}

type TopicHandlers = {
  get?: () => Promise<Response>;
  post?: () => Promise<Response>;
};

function installApiMock(fetchMock: Mock<typeof fetch>, handlers: TopicHandlers = {}) {
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
    if (url.pathname === '/api/topics' && init?.method === 'POST') {
      return handlers.post?.() ?? Promise.resolve(jsonResponse(topic, 201));
    }
    if (url.pathname === '/api/topics') {
      return handlers.get?.() ?? Promise.resolve(jsonResponse([topic]));
    }

    throw new Error(`Unexpected request: ${url.pathname}`);
  });
}

async function signInAndOpenTopics(fetchMock: Mock<typeof fetch>, handlers?: TopicHandlers) {
  installApiMock(fetchMock, handlers);
  const view = renderApp('/login');
  await view.user.type(screen.getByLabelText('Email'), 'topics@example.com');
  await view.user.type(screen.getByLabelText('Password'), 'not-a-real-password');
  await view.user.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('heading', { name: /you’re signed in/i });
  await view.user.click(screen.getByRole('link', { name: /topics/i }));
  return view;
}

describe('topics API and page', () => {
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

  it('gets the unpaginated topic list with bearer auth and AbortSignal', async () => {
    authSession.start('current-topics-token');
    fetchMock.mockResolvedValueOnce(jsonResponse([topic]));
    const controller = new AbortController();

    await expect(getTopics(controller.signal)).resolves.toEqual([topic]);

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/api/topics');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer current-topics-token');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('creates a topic with only the verified request fields', async () => {
    authSession.start('current-topics-token');
    fetchMock.mockResolvedValueOnce(jsonResponse(topic, 201));

    await expect(
      createTopic({ title: topic.title, description: topic.description }),
    ).resolves.toEqual(topic);

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/api/topics');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer current-topics-token');
    if (typeof init.body !== 'string') {
      throw new Error('Expected the create-topic request body to be JSON');
    }
    expect(JSON.parse(init.body) as unknown).toEqual({
      title: topic.title,
      description: topic.description,
    });
  });

  it('renders topic title, optional description and backend status label', async () => {
    await signInAndOpenTopics(fetchMock, {
      get: () =>
        Promise.resolve(
          jsonResponse([
            topic,
            { ...topic, id: 8, title: 'React', description: null, status: 'IN_PROGRESS' },
            { ...topic, id: 9, title: 'SQL', description: '', status: 'COMPLETED' },
          ]),
        ),
    });

    expect(await screen.findByRole('heading', { name: 'My Topics' })).toBeVisible();
    const list = screen.getByRole('list', { name: 'Learning topics' });
    expect(within(list).getByText(topic.title)).toBeVisible();
    expect(within(list).getByText(topic.description)).toBeVisible();
    expect(within(list).getByText('Planned')).toBeVisible();
    expect(within(list).getByText('In progress')).toBeVisible();
    expect(within(list).getByText('Completed')).toBeVisible();
  });

  it('shows the loading and empty states', async () => {
    const pending = await signInAndOpenTopics(fetchMock, {
      get: () => new Promise<Response>(() => undefined),
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Loading topics…');
    pending.unmount();
    authSession.clear();

    installApiMock(fetchMock, { get: () => Promise.resolve(jsonResponse([])) });
    const empty = renderApp('/login');
    await empty.user.type(screen.getByLabelText('Email'), 'topics@example.com');
    await empty.user.type(screen.getByLabelText('Password'), 'not-a-real-password');
    await empty.user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { name: /you’re signed in/i });
    await empty.user.click(screen.getByRole('link', { name: /topics/i }));
    expect(await screen.findByRole('heading', { name: 'No topics yet' })).toBeVisible();
  });

  it('shows a list error and retries GET /topics', async () => {
    let attempts = 0;
    const { user } = await signInAndOpenTopics(fetchMock, {
      get: () => {
        attempts += 1;
        return Promise.resolve(
          attempts === 1
            ? jsonResponse(apiError(500, 'Server error', '/api/topics'), 500)
            : jsonResponse([topic]),
        );
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Topics are unavailable');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(topic.title)).toBeVisible();
    expect(attempts).toBe(2);
  });

  it('validates create fields without a request', async () => {
    const { user } = await signInAndOpenTopics(fetchMock, {
      get: () => Promise.resolve(jsonResponse([])),
    });
    await screen.findByRole('heading', { name: 'No topics yet' });
    const requestsBefore = fetchMock.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Add Topic' }));
    await user.click(screen.getByRole('button', { name: 'Create topic' }));

    expect(screen.getByText('Enter a topic title.')).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(requestsBefore);
  });

  it('maps backend fieldErrors into the create form', async () => {
    const { user } = await signInAndOpenTopics(fetchMock, {
      get: () => Promise.resolve(jsonResponse([])),
      post: () =>
        Promise.resolve(
          jsonResponse(
            apiError(400, 'Validation failed', '/api/topics', [
              { field: 'title', message: 'Title is not accepted' },
            ]),
            400,
          ),
        ),
    });
    await screen.findByRole('heading', { name: 'No topics yet' });
    await user.click(screen.getByRole('button', { name: 'Add Topic' }));
    await user.type(screen.getByLabelText('Title'), 'Rejected title');
    await user.click(screen.getByRole('button', { name: 'Create topic' }));

    expect(await screen.findByText('Title is not accepted')).toBeVisible();
  });

  it('shows a network error and prevents repeat submission while pending', async () => {
    let rejectRequest: ((reason?: unknown) => void) | undefined;
    const { user } = await signInAndOpenTopics(fetchMock, {
      get: () => Promise.resolve(jsonResponse([])),
      post: () =>
        new Promise<Response>((_resolve, reject) => {
          rejectRequest = reject;
        }),
    });
    await screen.findByRole('heading', { name: 'No topics yet' });
    await user.click(screen.getByRole('button', { name: 'Add Topic' }));
    await user.type(screen.getByLabelText('Title'), 'Networks');
    await user.click(screen.getByRole('button', { name: 'Create topic' }));

    expect(await screen.findByRole('button', { name: 'Creating…' })).toBeDisabled();
    const postCalls = fetchMock.mock.calls.filter(([input, init]) => {
      const url =
        input instanceof URL
          ? input
          : new URL(typeof input === 'string' ? input : input.url, window.location.origin);
      return url.pathname === '/api/topics' && init?.method === 'POST';
    });
    expect(postCalls).toHaveLength(1);
    rejectRequest?.(new TypeError('Failed to fetch'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
  });

  it('closes and clears the form, refreshes topics, and invalidates dashboard summary', async () => {
    let topics = [] as (typeof topic)[];
    const queryClient = createTestQueryClient();
    installApiMock(fetchMock, {
      get: () => Promise.resolve(jsonResponse(topics)),
      post: () => {
        topics = [topic];
        return Promise.resolve(jsonResponse(topic, 201));
      },
    });
    const { user } = renderApp('/login', queryClient);
    queryClient.setQueryData(dashboardQueryKeys.summary(42), { totalTopics: 0 });
    await user.type(screen.getByLabelText('Email'), 'topics@example.com');
    await user.type(screen.getByLabelText('Password'), 'not-a-real-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { name: /you’re signed in/i });
    await user.click(screen.getByRole('link', { name: /topics/i }));
    await screen.findByRole('heading', { name: 'No topics yet' });
    await user.click(screen.getByRole('button', { name: 'Add Topic' }));
    await user.type(screen.getByLabelText('Title'), topic.title);
    await user.click(screen.getByRole('button', { name: 'Create topic' }));

    expect(await screen.findByText(topic.title)).toBeVisible();
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    expect(queryClient.getQueryState(dashboardQueryKeys.summary(42))?.isInvalidated).toBe(true);
  });

  it('rejects malformed API responses', async () => {
    authSession.start('current-topics-token');
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 1, title: 'Missing fields' }]));
    await expect(getTopics()).rejects.toMatchObject({ name: 'ResponseFormatError' });
  });

  it('logs out and clears topic cache after a protected 401 or manual logout', async () => {
    const queryClient = createTestQueryClient();
    installApiMock(fetchMock, {
      get: () =>
        Promise.resolve(
          jsonResponse(
            apiError(401, 'Authentication is required or token is invalid', '/api/topics'),
            401,
          ),
        ),
    });
    const { user } = renderApp('/login', queryClient);
    queryClient.setQueryData(topicQueryKeys.list(42), [topic]);
    await user.type(screen.getByLabelText('Email'), 'topics@example.com');
    await user.type(screen.getByLabelText('Password'), 'not-a-real-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { name: /you’re signed in/i });
    queryClient.removeQueries({ queryKey: topicQueryKeys.all(42) });
    await user.click(screen.getByRole('link', { name: /topics/i }));

    expect(await screen.findByRole('heading', { name: /sign in to codeprogress/i })).toBeVisible();
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0));
  });

  it('does not retain topic data after manual logout', async () => {
    const queryClient = createTestQueryClient();
    installApiMock(fetchMock);
    const { user } = renderApp('/login', queryClient);
    await user.type(screen.getByLabelText('Email'), 'topics@example.com');
    await user.type(screen.getByLabelText('Password'), 'not-a-real-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { name: /you’re signed in/i });
    await user.click(screen.getByRole('link', { name: /topics/i }));
    await screen.findByText(topic.title);
    expect(queryClient.getQueryData(topicQueryKeys.list(42))).toEqual([topic]);

    await user.click(screen.getByRole('button', { name: 'Logout' }));

    await screen.findByRole('heading', { name: /sign in to codeprogress/i });
    expect(queryClient.getQueryData(topicQueryKeys.list(42))).toBeUndefined();
  });

  it('protects the route and offers keyboard access to create controls', async () => {
    const protectedView = renderApp('/app/topics');
    expect(screen.getByRole('heading', { name: /sign in to codeprogress/i })).toBeVisible();
    protectedView.unmount();

    authSession.clear();
    const { user } = await signInAndOpenTopics(fetchMock, {
      get: () => Promise.resolve(jsonResponse([])),
    });
    await screen.findByRole('heading', { name: 'No topics yet' });
    const addButton = screen.getByRole('button', { name: 'Add Topic' });
    addButton.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByLabelText('Title')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Description (optional)')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Create topic' })).toHaveFocus();
  });
});
