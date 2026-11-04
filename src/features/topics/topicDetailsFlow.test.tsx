import { screen, waitFor } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import type { Mock } from 'vitest';
import { authSession } from '../auth/model/authSession';
import { getTopic, updateTopic, updateTopicStatus } from './api/topicsApi';
import { parseTopicId } from './lib/topicId';
import { topicQueryKeys } from './model/topicQueries';
import { createTestQueryClient, renderApp } from '../../test/renderApp';

const loginResponse = {
  accessToken: 'topic-details-test-token',
  tokenType: 'Bearer',
  expiresIn: 3600,
};

const currentUser = {
  id: 42,
  email: 'details@example.com',
  createdAt: '2026-10-27T10:00:00',
  updatedAt: '2026-10-27T10:00:00',
};

const topic = {
  id: 7,
  title: 'Java concurrency',
  description: 'Threads, executors and synchronization',
  status: 'PLANNED',
  createdAt: '2026-10-26T10:15:00',
  updatedAt: '2026-10-27T11:30:00',
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
    timestamp: '2026-10-27T10:00:00',
    status,
    error: status === 401 ? 'Unauthorized' : status === 404 ? 'Not Found' : 'Bad Request',
    message,
    path,
    fieldErrors,
  };
}

type DetailHandlers = {
  list?: () => Promise<Response>;
  detail?: () => Promise<Response>;
  put?: (body: unknown) => Promise<Response>;
  patch?: (body: unknown) => Promise<Response>;
};

function installApiMock(fetchMock: Mock<typeof fetch>, handlers: DetailHandlers = {}) {
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
      return handlers.list?.() ?? Promise.resolve(jsonResponse([topic]));
    }
    if (url.pathname === '/api/topics/7/status' && init?.method === 'PATCH') {
      const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : null;
      return (
        handlers.patch?.(body) ??
        Promise.resolve(
          jsonResponse({ ...topic, status: 'COMPLETED', updatedAt: '2026-10-27T12:00:00' }),
        )
      );
    }
    if (url.pathname === '/api/topics/7/tasks') {
      return Promise.resolve(jsonResponse([]));
    }
    if (url.pathname === '/api/topics/7/sessions') {
      return Promise.resolve(jsonResponse([]));
    }
    if (url.pathname === '/api/topics/7' && init?.method === 'PUT') {
      const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : null;
      return (
        handlers.put?.(body) ??
        Promise.resolve(
          jsonResponse({
            ...topic,
            title: 'Modern Java',
            description: 'Records and concurrency',
            updatedAt: '2026-10-27T12:00:00',
          }),
        )
      );
    }
    if (url.pathname === '/api/topics/7') {
      return handlers.detail?.() ?? Promise.resolve(jsonResponse(topic));
    }

    throw new Error(`Unexpected request: ${url.pathname}`);
  });
}

async function signInAndOpenTopic(
  fetchMock: Mock<typeof fetch>,
  handlers?: DetailHandlers,
  queryClient?: QueryClient,
) {
  installApiMock(fetchMock, handlers);
  const view = renderApp('/login', queryClient);
  await view.user.type(screen.getByLabelText('Email'), 'details@example.com');
  await view.user.type(screen.getByLabelText('Password'), 'not-a-real-password');
  await view.user.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('heading', { name: /you’re signed in/i });
  await view.user.click(screen.getByRole('link', { name: /topics/i }));
  await screen.findByRole('heading', { name: 'My Topics' });
  await view.user.click(await screen.findByRole('link', { name: topic.title }));
  return view;
}

describe('topic details, update and status flow', () => {
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

  it('gets and validates one topic with bearer auth and AbortSignal', async () => {
    authSession.start('detail-token');
    fetchMock.mockResolvedValueOnce(jsonResponse(topic));
    const controller = new AbortController();

    await expect(getTopic(7, controller.signal)).resolves.toEqual(topic);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/api/topics/7');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer detail-token');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('uses authenticated PUT and PATCH with the exact verified request bodies', async () => {
    authSession.start('mutation-token');
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ ...topic, title: 'Modern Java' }))
      .mockResolvedValueOnce(jsonResponse({ ...topic, status: 'IN_PROGRESS' }));

    await updateTopic(7, { title: 'Modern Java', description: null });
    await updateTopicStatus(7, { status: 'IN_PROGRESS' });

    const [putUrl, putInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const [patchUrl, patchInit] = fetchMock.mock.calls[1] as [URL, RequestInit];
    expect(putUrl.pathname).toBe('/api/topics/7');
    expect(putInit.method).toBe('PUT');
    expect(putInit.body).toBe(JSON.stringify({ title: 'Modern Java', description: null }));
    expect(new Headers(putInit.headers).get('Authorization')).toBe('Bearer mutation-token');
    expect(patchUrl.pathname).toBe('/api/topics/7/status');
    expect(patchInit.method).toBe('PATCH');
    expect(patchInit.body).toBe(JSON.stringify({ status: 'IN_PROGRESS' }));
    expect(new Headers(patchInit.headers).get('Authorization')).toBe('Bearer mutation-token');
  });

  it('navigates from the list and renders details, status and LocalDateTime fields', async () => {
    await signInAndOpenTopic(fetchMock);

    expect(await screen.findByRole('heading', { name: topic.title })).toBeVisible();
    expect(screen.getByText(topic.description)).toBeVisible();
    expect(screen.getByText('Planned')).toBeVisible();
    expect(screen.getByText('26.10.2026, 10:15')).toBeVisible();
    expect(screen.getByText('27.10.2026, 11:30')).toBeVisible();
    expect(screen.getByRole('link', { name: /back to topics/i })).toBeVisible();
  });

  it('rejects invalid topic route identifiers without inventing a request', () => {
    expect(parseTopicId(undefined)).toBeNull();
    expect(parseTopicId('0')).toBeNull();
    expect(parseTopicId('-1')).toBeNull();
    expect(parseTopicId('abc')).toBeNull();
    expect(parseTopicId('1e2')).toBeNull();
    expect(parseTopicId('7')).toBe(7);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a distinct 404 state with retry', async () => {
    await signInAndOpenTopic(fetchMock, {
      detail: () =>
        Promise.resolve(
          jsonResponse(apiError(404, 'Topic with id 7 was not found', '/api/topics/7'), 404),
        ),
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /does not exist or does not belong/i,
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  it('shows loading, network error and successfully retries details', async () => {
    let resolveFirst: ((response: Response) => void) | undefined;
    let attempts = 0;
    const viewPromise = signInAndOpenTopic(fetchMock, {
      detail: () => {
        attempts += 1;
        if (attempts === 1) {
          return new Promise<Response>((resolve) => {
            resolveFirst = resolve;
          });
        }
        return Promise.resolve(jsonResponse(topic));
      },
    });

    const view = await viewPromise;
    expect(await screen.findByRole('status')).toHaveTextContent('Loading topic…');
    resolveFirst?.(Promise.reject(new TypeError('Failed to fetch')) as unknown as Response);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
    await view.user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: topic.title })).toBeVisible();
  });

  it('rejects malformed detail and mutation responses', async () => {
    authSession.start('detail-token');
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: 7, title: 'Incomplete' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'PLANNED' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'COMPLETED' }));

    await expect(getTopic(7)).rejects.toMatchObject({ name: 'ResponseFormatError' });
    await expect(updateTopic(7, { title: 'Title', description: null })).rejects.toMatchObject({
      name: 'ResponseFormatError',
    });
    await expect(updateTopicStatus(7, { status: 'COMPLETED' })).rejects.toMatchObject({
      name: 'ResponseFormatError',
    });
  });

  it('updates exact editable fields and synchronizes detail/list caches', async () => {
    const queryClient = createTestQueryClient();
    const putSpy = vi.fn<(body: unknown) => Promise<Response>>((body) =>
      Promise.resolve(
        jsonResponse({
          ...topic,
          ...(body as { title: string; description: string | null }),
          updatedAt: '2026-10-27T12:00:00',
        }),
      ),
    );
    const { user } = await signInAndOpenTopic(fetchMock, { put: putSpy }, queryClient);
    await screen.findByRole('heading', { name: topic.title });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const titleInput = screen.getByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Modern Java');
    const descriptionInput = screen.getByLabelText('Description (optional)');
    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'Records and concurrency');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('heading', { name: 'Modern Java' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Topic details updated.');
    expect(putSpy).toHaveBeenCalledWith({
      title: 'Modern Java',
      description: 'Records and concurrency',
    });
    expect(queryClient.getQueryData(topicQueryKeys.detail(42, 7))).toMatchObject({
      title: 'Modern Java',
    });
    expect(queryClient.getQueryData(topicQueryKeys.list(42))).toEqual([
      expect.objectContaining({ id: 7, title: 'Modern Java' }),
    ]);
    expect(queryClient.getQueryState(topicQueryKeys.detail(42, 7))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(topicQueryKeys.list(42))?.isInvalidated).toBe(true);
  });

  it('validates edits locally and maps backend fieldErrors', async () => {
    const { user } = await signInAndOpenTopic(fetchMock, {
      put: () =>
        Promise.resolve(
          jsonResponse(
            apiError(400, 'Request validation failed', '/api/topics/7', [
              { field: 'title', message: 'Title is not accepted' },
            ]),
            400,
          ),
        ),
    });
    await screen.findByRole('heading', { name: topic.title });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const input = screen.getByLabelText('Title');
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText('Enter a topic title.')).toBeVisible();
    await user.type(input, 'Rejected');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Title is not accepted')).toBeVisible();
  });

  it('cancels a prefilled edit without changing topic data', async () => {
    const { user } = await signInAndOpenTopic(fetchMock);
    await screen.findByRole('heading', { name: topic.title });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Title')).toHaveValue(topic.title);
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Unsaved title');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: topic.title })).toBeVisible();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
  });

  it('sends an exact enum PATCH and synchronizes detail/list caches', async () => {
    const queryClient = createTestQueryClient();
    const patchSpy = vi.fn<(body: unknown) => Promise<Response>>(() =>
      Promise.resolve(
        jsonResponse({ ...topic, status: 'COMPLETED', updatedAt: '2026-10-27T12:00:00' }),
      ),
    );
    const { user } = await signInAndOpenTopic(fetchMock, { patch: patchSpy }, queryClient);
    await screen.findByRole('heading', { name: topic.title });
    await user.click(screen.getByRole('button', { name: 'Change Status' }));
    const select = screen.getByLabelText('Status');
    expect(Array.from((select as HTMLSelectElement).options).map((option) => option.value)).toEqual(
      ['PLANNED', 'IN_PROGRESS', 'COMPLETED'],
    );
    await user.selectOptions(select, 'COMPLETED');
    await user.click(screen.getByRole('button', { name: 'Update status' }));

    expect(await screen.findByText('Completed')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Topic status changed.');
    expect(patchSpy).toHaveBeenCalledWith({ status: 'COMPLETED' });
    expect(queryClient.getQueryData(topicQueryKeys.detail(42, 7))).toMatchObject({
      status: 'COMPLETED',
    });
    expect(queryClient.getQueryData(topicQueryKeys.list(42))).toEqual([
      expect.objectContaining({ id: 7, status: 'COMPLETED' }),
    ]);
    expect(queryClient.getQueryState(topicQueryKeys.detail(42, 7))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(topicQueryKeys.list(42))?.isInvalidated).toBe(true);
  });

  it('blocks duplicate PUT submissions while the mutation is pending', async () => {
    let resolvePut: ((response: Response) => void) | undefined;
    const putSpy = vi.fn<(body: unknown) => Promise<Response>>(
      () =>
        new Promise<Response>((resolve) => {
          resolvePut = resolve;
        }),
    );
    const { user } = await signInAndOpenTopic(fetchMock, { put: putSpy });
    await screen.findByRole('heading', { name: topic.title });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(putSpy).toHaveBeenCalledTimes(1);
    resolvePut?.(jsonResponse(topic));
    await screen.findByText('Topic details updated.');
  });

  it('handles backend status validation errors and blocks duplicate PATCH requests', async () => {
    let rejectPatch: ((reason?: unknown) => void) | undefined;
    const patchSpy = vi
      .fn<(body: unknown) => Promise<Response>>()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((_resolve, reject) => {
            rejectPatch = reject;
          }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          apiError(400, 'Request validation failed', '/api/topics/7/status', [
            { field: 'status', message: 'Status is required' },
          ]),
          400,
        ),
      );
    const { user } = await signInAndOpenTopic(fetchMock, { patch: patchSpy });
    await screen.findByRole('heading', { name: topic.title });
    await user.click(screen.getByRole('button', { name: 'Change Status' }));
    await user.selectOptions(screen.getByLabelText('Status'), 'IN_PROGRESS');
    await user.click(screen.getByRole('button', { name: 'Update status' }));
    expect(await screen.findByRole('button', { name: 'Updating…' })).toBeDisabled();
    expect(patchSpy).toHaveBeenCalledTimes(1);
    rejectPatch?.(new TypeError('Failed to fetch'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
    await user.click(screen.getByRole('button', { name: 'Update status' }));
    expect(await screen.findByText('Status is required')).toBeVisible();
    expect(patchSpy).toHaveBeenCalledTimes(2);
  });

  it('logs out and clears caches on a detail 401', async () => {
    const queryClient = createTestQueryClient();
    await signInAndOpenTopic(
      fetchMock,
      {
        detail: () =>
          Promise.resolve(
            jsonResponse(
              apiError(401, 'Authentication is required or token is invalid', '/api/topics/7'),
              401,
            ),
          ),
      },
      queryClient,
    );

    expect(await screen.findByRole('heading', { name: /sign in to codeprogress/i })).toBeVisible();
    expect(authSession.getAccessToken()).toBeNull();
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0));
  });

  it('logs out only the current session when a Topic mutation returns 401', async () => {
    const queryClient = createTestQueryClient();
    const putSpy = vi.fn<(body: unknown) => Promise<Response>>(() =>
      Promise.resolve(
        jsonResponse(
          apiError(401, 'Authentication is required or token is invalid', '/api/topics/7'),
          401,
        ),
      ),
    );
    const { user } = await signInAndOpenTopic(fetchMock, { put: putSpy }, queryClient);
    await screen.findByRole('heading', { name: topic.title });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('heading', { name: /sign in to codeprogress/i })).toBeVisible();
    expect(authSession.getAccessToken()).toBeNull();
    expect(putSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Topic details updated.')).not.toBeInTheDocument();
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0));
  });

  it('never reads another user’s detail cache and clears it on session end', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(topicQueryKeys.detail(99, 7), {
      ...topic,
      title: 'Another user private topic',
    });
    const { user } = await signInAndOpenTopic(fetchMock, undefined, queryClient);

    expect(await screen.findByRole('heading', { name: topic.title })).toBeVisible();
    expect(screen.queryByText('Another user private topic')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0));
  });

  it('provides accessible labels and keyboard navigation for both actions', async () => {
    const { user } = await signInAndOpenTopic(fetchMock);
    await screen.findByRole('heading', { name: topic.title });
    const editButton = screen.getByRole('button', { name: 'Edit' });
    editButton.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByLabelText('Title')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Description (optional)')).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Change Status' }));
    expect(screen.getByLabelText('Status')).toHaveFocus();
  });
});
