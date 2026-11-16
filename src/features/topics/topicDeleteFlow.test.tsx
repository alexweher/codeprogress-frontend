import { screen, waitFor, within } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import type { Mock } from 'vitest';
import { authSession } from '../auth/model/authSession';
import { dashboardQueryKeys } from '../dashboard/model/dashboardQueries';
import { deleteTopic } from './api/topicsApi';
import { topicQueryKeys } from './model/topicQueries';
import { createTestQueryClient, renderApp } from '../../test/renderApp';

const loginResponse = {
  accessToken: 'delete-topic-test-token',
  tokenType: 'Bearer',
  expiresIn: 3600,
};

const currentUser = {
  id: 42,
  email: 'delete@example.com',
  createdAt: '2026-10-27T10:00:00',
  updatedAt: '2026-10-27T10:00:00',
};

const topic = {
  id: 7,
  title: 'Disposable test topic',
  description: 'A synthetic topic used only by mocked tests',
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

function apiError(status: number, message: string, path = '/api/topics/7') {
  return {
    timestamp: '2026-10-27T10:00:00',
    status,
    error:
      status === 401
        ? 'Unauthorized'
        : status === 404
          ? 'Not Found'
          : status === 409
            ? 'Conflict'
            : 'Bad Request',
    message,
    path,
    fieldErrors: [],
  };
}

type DeleteHandlers = {
  list?: () => Promise<Response>;
  detail?: () => Promise<Response>;
  delete?: () => Promise<Response>;
};

function installApiMock(fetchMock: Mock<typeof fetch>, handlers: DeleteHandlers = {}) {
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
    if (url.pathname === '/api/topics/7' && init?.method === 'DELETE') {
      return handlers.delete?.() ?? Promise.resolve(new Response(null, { status: 204 }));
    }
    if (url.pathname === '/api/topics/7/tasks') {
      return Promise.resolve(jsonResponse([]));
    }
    if (url.pathname === '/api/topics/7/sessions') {
      return Promise.resolve(jsonResponse([]));
    }
    if (url.pathname === '/api/topics/7') {
      return handlers.detail?.() ?? Promise.resolve(jsonResponse(topic));
    }

    throw new Error(`Unexpected request: ${url.pathname}`);
  });
}

async function signInAndOpenTopic(
  fetchMock: Mock<typeof fetch>,
  handlers?: DeleteHandlers,
  queryClient?: QueryClient,
) {
  installApiMock(fetchMock, handlers);
  const view = renderApp('/app/topics/7', queryClient);
  await view.user.type(screen.getByLabelText('Email'), 'delete@example.com');
  await view.user.type(screen.getByLabelText('Password'), 'not-a-real-password');
  await view.user.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('heading', { name: topic.title });
  return view;
}

async function openDeleteDialog(user: Awaited<ReturnType<typeof signInAndOpenTopic>>['user']) {
  await user.click(screen.getByRole('button', { name: 'Topic actions' }));
  await user.click(screen.getByRole('menuitem', { name: 'Delete Topic' }));
}

function deleteCalls(fetchMock: Mock<typeof fetch>) {
  return fetchMock.mock.calls.filter(([input, init]) => {
    const url =
      input instanceof URL
        ? input
        : new URL(typeof input === 'string' ? input : input.url, window.location.origin);
    return url.pathname === '/api/topics/7' && init?.method === 'DELETE';
  });
}

describe('safe topic deletion', () => {
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

  it('uses the exact authenticated DELETE URL and accepts an empty 204 response', async () => {
    authSession.start('delete-token');
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(deleteTopic(7)).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/api/topics/7');
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer delete-token');
  });

  it('does not accept an unexpected successful status as a confirmed deletion', async () => {
    authSession.start('delete-token');
    fetchMock.mockResolvedValueOnce(jsonResponse({ deleted: true }, 200));

    await expect(deleteTopic(7)).rejects.toMatchObject({ name: 'ResponseFormatError' });
  });

  it('shows Delete Topic and opens a labelled confirmation without sending DELETE', async () => {
    const { user } = await signInAndOpenTopic(fetchMock);

    const trigger = screen.getByRole('button', { name: 'Topic actions' });
    expect(trigger).toBeVisible();
    await openDeleteDialog(user);

    const dialog = screen.getByRole('dialog', { name: 'Delete Topic?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText(topic.title)).toBeVisible();
    expect(within(dialog).getByText(/permanent and cannot be undone/i)).toBeVisible();
    expect(deleteCalls(fetchMock)).toHaveLength(0);
  });

  it('cancels without a request and restores focus to the trigger', async () => {
    const { user } = await signInAndOpenTopic(fetchMock);
    const trigger = screen.getByRole('button', { name: 'Topic actions' });
    await openDeleteDialog(user);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(deleteCalls(fetchMock)).toHaveLength(0);
  });

  it('deletes after confirmation, updates caches and navigates with success feedback', async () => {
    let deleted = false;
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(dashboardQueryKeys.summary(42), { totalTopics: 1 });
    const { user } = await signInAndOpenTopic(
      fetchMock,
      {
        list: () => Promise.resolve(jsonResponse(deleted ? [] : [topic])),
        delete: () => {
          deleted = true;
          return Promise.resolve(new Response(null, { status: 204 }));
        },
      },
      queryClient,
    );
    await openDeleteDialog(user);
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Topic deleted successfully.')).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'No topics yet' })).toBeVisible();
    await waitFor(() =>
      expect(queryClient.getQueryData(topicQueryKeys.detail(42, 7))).toBeUndefined(),
    );
    expect(queryClient.getQueryData(topicQueryKeys.list(42))).toEqual([]);
    expect(queryClient.getQueryState(topicQueryKeys.list(42))?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(dashboardQueryKeys.summary(42))?.isInvalidated).toBe(true);
  });

  it('shows pending state and prevents duplicate confirmation', async () => {
    let resolveDelete: ((response: Response) => void) | undefined;
    let deleted = false;
    const deleteHandler = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveDelete = (response) => {
            deleted = true;
            resolve(response);
          };
        }),
    );
    const { user } = await signInAndOpenTopic(fetchMock, {
      list: () => Promise.resolve(jsonResponse(deleted ? [] : [topic])),
      delete: deleteHandler,
    });
    await openDeleteDialog(user);
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('button', { name: 'Deleting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(deleteHandler).toHaveBeenCalledTimes(1);
    resolveDelete?.(new Response(null, { status: 204 }));
    expect(await screen.findByText('Topic deleted successfully.')).toBeVisible();
  });

  it('keeps the topic and explains a confirmed 409 relationship conflict', async () => {
    const queryClient = createTestQueryClient();
    const { user } = await signInAndOpenTopic(
      fetchMock,
      {
        delete: () =>
          Promise.resolve(
            jsonResponse(
              apiError(
                409,
                'Topic with id 7 cannot be deleted because it has learning tasks or study sessions',
              ),
              409,
            ),
          ),
      },
      queryClient,
    );
    await openDeleteDialog(user);
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/learning tasks or study sessions/i);
    expect(screen.getByRole('heading', { name: topic.title })).toBeVisible();
    expect(queryClient.getQueryData(topicQueryKeys.detail(42, 7))).toEqual(topic);
  });

  it('handles 404 and offers a safe return to Topics', async () => {
    const { user } = await signInAndOpenTopic(fetchMock, {
      delete: () =>
        Promise.resolve(jsonResponse(apiError(404, 'Topic with id 7 was not found'), 404)),
    });
    await openDeleteDialog(user);
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /already absent|no longer available/i,
    );
    await user.click(screen.getByRole('button', { name: 'Back to Topics' }));
    expect(await screen.findByRole('heading', { name: 'My Topics' })).toBeVisible();
  });

  it('uses the existing logout lifecycle for DELETE 401', async () => {
    const queryClient = createTestQueryClient();
    const { user } = await signInAndOpenTopic(
      fetchMock,
      {
        delete: () =>
          Promise.resolve(
            jsonResponse(apiError(401, 'Authentication is required or token is invalid'), 401),
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

  it('does not claim success after a network failure and can re-check topic state', async () => {
    let detailCalls = 0;
    const { user } = await signInAndOpenTopic(fetchMock, {
      detail: () => {
        detailCalls += 1;
        return Promise.resolve(jsonResponse(topic));
      },
      delete: () => Promise.reject(new TypeError('Failed to fetch')),
    });
    await openDeleteDialog(user);
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot confirm whether/i);
    expect(screen.queryByText('Topic deleted successfully.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Check topic state' }));
    await waitFor(() => expect(detailCalls).toBe(2));
    expect(screen.getByRole('heading', { name: topic.title })).toBeVisible();
  });

  it('ignores a delayed success after the authenticated session changes', async () => {
    let resolveDelete: ((response: Response) => void) | undefined;
    const queryClient = createTestQueryClient();
    const { user } = await signInAndOpenTopic(
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
    queryClient.setQueryData(topicQueryKeys.list(88), [{ ...topic, title: 'New session topic' }]);
    queryClient.setQueryData(dashboardQueryKeys.summary(88), { totalTopics: 1 });
    resolveDelete?.(new Response(null, { status: 204 }));

    await waitFor(() =>
      expect(queryClient.getQueryData(topicQueryKeys.list(88))).toEqual([
        expect.objectContaining({ title: 'New session topic' }),
      ]),
    );
    expect(queryClient.getQueryState(dashboardQueryKeys.summary(88))?.isInvalidated).toBe(false);
    expect(queryClient.getQueryData(topicQueryKeys.list(42))).toBeUndefined();
  });

  it('supports Escape, traps keyboard focus and restores it after closing', async () => {
    const { user } = await signInAndOpenTopic(fetchMock);
    const trigger = screen.getByRole('button', { name: 'Topic actions' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}{ArrowDown}');
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
