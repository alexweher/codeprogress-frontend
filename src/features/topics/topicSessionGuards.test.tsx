import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Mock } from 'vitest';
import { RequestAbortedError } from '../../shared/api/apiError';
import { createTestQueryClient } from '../../test/renderApp';
import { authSession } from '../auth/model/authSession';
import { dashboardQueryKeys } from '../dashboard/model/dashboardQueries';
import type { TopicResponse } from './api/topicsApi';
import {
  topicQueryKeys,
  useCreateTopic,
  useUpdateTopic,
  useUpdateTopicStatus,
} from './model/topicQueries';

const topic = {
  id: 7,
  title: 'Java concurrency',
  description: 'Threads, executors and synchronization',
  status: 'PLANNED',
  createdAt: '2026-10-26T10:00:00',
  updatedAt: '2026-10-26T10:00:00',
} as const;

const replacementUserTopic = {
  ...topic,
  id: 99,
  title: 'Replacement user topic',
} as const;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function queryWrapper(queryClient: ReturnType<typeof createTestQueryClient>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function expectSingleAuthenticatedRequest(
  fetchMock: Mock<typeof fetch>,
  method: 'POST' | 'PUT' | 'PATCH',
  path: string,
  token: string,
) {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
  expect(url.pathname).toBe(path);
  expect(init.method).toBe(method);
  expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${token}`);
}

describe('Topic mutation session guards', () => {
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

  it('rejects a delayed create response after Logout without cache or success side effects', async () => {
    const oldToken = 'old-create-session-token';
    const response = deferred<Response>();
    const queryClient = createTestQueryClient();
    const success = vi.fn();
    authSession.start(oldToken);
    fetchMock.mockReturnValue(response.promise);

    const { result } = renderHook(() => useCreateTopic(42), {
      wrapper: queryWrapper(queryClient),
    });
    let mutationPromise!: Promise<TopicResponse>;
    act(() => {
      mutationPromise = result.current.mutateAsync(
        { title: topic.title, description: topic.description },
        { onSuccess: success },
      );
    });

    await waitFor(() =>
      expectSingleAuthenticatedRequest(fetchMock, 'POST', '/api/topics', oldToken),
    );
    authSession.clear();
    queryClient.clear();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      response.resolve(jsonResponse(topic, 201));
      await expect(mutationPromise).rejects.toBeInstanceOf(RequestAbortedError);
    });

    expect(authSession.getAccessToken()).toBeNull();
    expect(success).not.toHaveBeenCalled();
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(topicQueryKeys.list(42))).toBeUndefined();
    expect(queryClient.getQueryData(dashboardQueryKeys.summary(42))).toBeUndefined();
    expectSingleAuthenticatedRequest(fetchMock, 'POST', '/api/topics', oldToken);
  });

  it('rejects a delayed update response after account switch and preserves the new user cache', async () => {
    const oldToken = 'old-update-session-token';
    const newToken = 'replacement-update-session-token';
    const response = deferred<Response>();
    const queryClient = createTestQueryClient();
    const success = vi.fn();
    authSession.start(oldToken);
    fetchMock.mockReturnValue(response.promise);

    const { result } = renderHook(() => useUpdateTopic(42, topic.id), {
      wrapper: queryWrapper(queryClient),
    });
    let mutationPromise!: Promise<TopicResponse>;
    act(() => {
      mutationPromise = result.current.mutateAsync(
        { title: 'Updated by old session', description: null },
        { onSuccess: success },
      );
    });

    await waitFor(() =>
      expectSingleAuthenticatedRequest(fetchMock, 'PUT', `/api/topics/${topic.id}`, oldToken),
    );
    authSession.clear();
    queryClient.clear();
    authSession.start(newToken);
    queryClient.setQueryData(topicQueryKeys.list(99), [replacementUserTopic]);
    queryClient.setQueryData(
      topicQueryKeys.detail(99, replacementUserTopic.id),
      replacementUserTopic,
    );
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      response.resolve(
        jsonResponse({ ...topic, title: 'Updated by old session', description: null }),
      );
      await expect(mutationPromise).rejects.toBeInstanceOf(RequestAbortedError);
    });

    expect(authSession.getAccessToken()).toBe(newToken);
    expect(success).not.toHaveBeenCalled();
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(topicQueryKeys.detail(42, topic.id))).toBeUndefined();
    expect(queryClient.getQueryData(topicQueryKeys.list(42))).toBeUndefined();
    expect(queryClient.getQueryData(topicQueryKeys.list(99))).toEqual([replacementUserTopic]);
    expect(queryClient.getQueryData(topicQueryKeys.detail(99, replacementUserTopic.id))).toEqual(
      replacementUserTopic,
    );
    expectSingleAuthenticatedRequest(fetchMock, 'PUT', `/api/topics/${topic.id}`, oldToken);
  });

  it('rejects a delayed status response after account switch without invalidation or false success', async () => {
    const oldToken = 'old-status-session-token';
    const newToken = 'replacement-status-session-token';
    const response = deferred<Response>();
    const queryClient = createTestQueryClient();
    const success = vi.fn();
    authSession.start(oldToken);
    fetchMock.mockReturnValue(response.promise);

    const { result } = renderHook(() => useUpdateTopicStatus(42, topic.id), {
      wrapper: queryWrapper(queryClient),
    });
    let mutationPromise!: Promise<TopicResponse>;
    act(() => {
      mutationPromise = result.current.mutateAsync(
        { status: 'IN_PROGRESS' },
        { onSuccess: success },
      );
    });

    await waitFor(() =>
      expectSingleAuthenticatedRequest(
        fetchMock,
        'PATCH',
        `/api/topics/${topic.id}/status`,
        oldToken,
      ),
    );
    authSession.clear();
    queryClient.clear();
    authSession.start(newToken);
    queryClient.setQueryData(topicQueryKeys.list(99), [replacementUserTopic]);
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      response.resolve(jsonResponse({ ...topic, status: 'IN_PROGRESS' }));
      await expect(mutationPromise).rejects.toBeInstanceOf(RequestAbortedError);
    });

    expect(authSession.getAccessToken()).toBe(newToken);
    expect(success).not.toHaveBeenCalled();
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(topicQueryKeys.detail(42, topic.id))).toBeUndefined();
    expect(queryClient.getQueryData(topicQueryKeys.list(42))).toBeUndefined();
    expect(queryClient.getQueryData(topicQueryKeys.list(99))).toEqual([replacementUserTopic]);
    expectSingleAuthenticatedRequest(
      fetchMock,
      'PATCH',
      `/api/topics/${topic.id}/status`,
      oldToken,
    );
  });
});
