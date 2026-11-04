import { act, screen, waitFor } from '@testing-library/react';
import type { Mock } from 'vitest';
import { getCurrentUser } from './api/authApi';
import { authSession } from './model/authSession';
import { createTestQueryClient, renderApp } from '../../test/renderApp';

const loginResponse = {
  accessToken: 'test-access-token',
  tokenType: 'Bearer',
  expiresIn: 3600,
};

const currentUserResponse = {
  id: 42,
  email: 'learner@example.com',
  createdAt: '2026-10-25T10:00:00',
  updatedAt: '2026-10-25T10:00:00',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function apiError(status: number, message: string, path: string) {
  return {
    timestamp: '2026-10-25T10:00:00',
    status,
    error: status === 401 ? 'Unauthorized' : 'Bad Request',
    message,
    path,
    fieldErrors: [],
  };
}

async function submitLogin(fetchMock: Mock<typeof fetch>) {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(loginResponse))
    .mockResolvedValueOnce(jsonResponse(currentUserResponse));

  const view = renderApp('/login');
  await view.user.type(screen.getByLabelText('Email'), 'learner@example.com');
  await view.user.type(screen.getByLabelText('Password'), 'not-a-real-password');
  await view.user.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('heading', { name: /you’re signed in/i });

  return view;
}

describe('authentication flow', () => {
  let fetchMock: Mock<typeof fetch>;

  beforeEach(() => {
    authSession.clear();
    localStorage.clear();
    sessionStorage.clear();
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    authSession.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('logs in, verifies the current user, and redirects to /app', async () => {
    await submitLogin(fetchMock);

    expect(screen.getByText('learner@example.com')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [loginUrl, loginInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(loginUrl.pathname).toBe('/api/auth/login');
    expect(new Headers(loginInit.headers).has('Authorization')).toBe(false);
    if (typeof loginInit.body !== 'string') {
      throw new Error('Expected the login request body to be JSON');
    }
    expect(JSON.parse(loginInit.body) as unknown).toEqual({
      email: 'learner@example.com',
      password: 'not-a-real-password',
    });

    const [userUrl, userInit] = fetchMock.mock.calls[1] as [URL, RequestInit];
    expect(userUrl.pathname).toBe('/api/users/me');
    expect(new Headers(userInit.headers).get('Authorization')).toBe('Bearer test-access-token');
  });

  it('shows a form error for incorrect credentials without requesting /users/me', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(apiError(401, 'Invalid email or password', '/api/auth/login'), 401),
    );
    const { user } = renderApp('/login');

    await user.type(screen.getByLabelText('Email'), 'learner@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(authSession.getAccessToken()).toBeNull();
  });

  it('shows a distinct message for a network failure', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { user } = renderApp('/login');

    await user.type(screen.getByLabelText('Email'), 'learner@example.com');
    await user.type(screen.getByLabelText('Password'), 'not-a-real-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/unable to reach codeprogress/i);
  });

  it('gets and validates the current user with the bearer token', async () => {
    authSession.start('current-token');
    fetchMock.mockResolvedValueOnce(jsonResponse(currentUserResponse));

    await expect(getCurrentUser()).resolves.toEqual(currentUserResponse);

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer current-token');
  });

  it('logs out, redirects, and clears the user-scoped query cache', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['current-user', 42], currentUserResponse);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponse))
      .mockResolvedValueOnce(jsonResponse(currentUserResponse));
    const { user } = renderApp('/login', queryClient);

    await user.type(screen.getByLabelText('Email'), 'learner@example.com');
    await user.type(screen.getByLabelText('Password'), 'not-a-real-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { name: /you’re signed in/i });
    await user.click(screen.getByRole('button', { name: 'Logout' }));

    expect(await screen.findByRole('heading', { name: /sign in to codeprogress/i })).toBeVisible();
    expect(authSession.getAccessToken()).toBeNull();
    expect(queryClient.getQueryData(['current-user', 42])).toBeUndefined();
  });

  it('safely logs out when a protected request returns 401', async () => {
    await submitLogin(fetchMock);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        apiError(401, 'Authentication is required or token is invalid', '/api/users/me'),
        401,
      ),
    );

    await act(async () => {
      await expect(getCurrentUser()).rejects.toMatchObject({ status: 401 });
    });

    expect(await screen.findByRole('heading', { name: /sign in to codeprogress/i })).toBeVisible();
    expect(authSession.getAccessToken()).toBeNull();
  });

  it('never stores the access token in localStorage, sessionStorage, or cookies', async () => {
    const localStorageSpy = vi.spyOn(Storage.prototype, 'setItem');
    await submitLogin(fetchMock);

    expect(localStorageSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(sessionStorage.getItem('accessToken')).toBeNull();
    expect(document.cookie).not.toContain('test-access-token');
  });

  it('supports keyboard navigation through the login form', async () => {
    const { user } = renderApp('/login');

    await user.tab();
    expect(screen.getByLabelText('Email')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Password')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveFocus();
  });

  it('shows client-side validation and does not submit an empty form', async () => {
    const { user } = renderApp('/login');

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Email is required.')).toBeVisible();
    expect(screen.getByText('Password is required.')).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('disables repeated submission while the login request is pending', async () => {
    fetchMock.mockImplementationOnce(() => new Promise<Response>(() => undefined));
    const { user } = renderApp('/login');

    await user.type(screen.getByLabelText('Email'), 'learner@example.com');
    await user.type(screen.getByLabelText('Password'), 'not-a-real-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
