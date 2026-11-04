import { render, screen, waitFor } from '@testing-library/react';
import type { Mock } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../../app/router';
import { createTestQueryClient, renderApp } from '../../test/renderApp';
import { AuthContext, type AuthContextValue } from './model/AuthContext';
import { authSession } from './model/authSession';

const createdUserResponse = {
  id: 73,
  email: 'new.learner@example.com',
  createdAt: '2026-10-25T12:00:00',
  updatedAt: '2026-10-25T12:00:00',
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
    timestamp: '2026-10-25T12:00:00',
    status,
    error: status === 409 ? 'Conflict' : 'Bad Request',
    message,
    path: '/api/auth/register',
    fieldErrors,
  };
}

async function fillRegistrationForm(user: ReturnType<typeof renderApp>['user']) {
  await user.type(screen.getByLabelText('Email'), 'New.Learner@Example.com');
  await user.type(screen.getByLabelText('Password'), 'safe-test-password');
}

describe('registration flow', () => {
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

  it('registers with HTTP 201, then opens login with a success message and safe email prefill', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(createdUserResponse, 201));
    const { user } = renderApp('/register');

    await fillRegistrationForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/account created/i);
    expect(screen.getByRole('heading', { name: /sign in to codeprogress/i })).toBeVisible();
    expect(screen.getByLabelText('Email')).toHaveValue('new.learner@example.com');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/api/auth/register');
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
    if (typeof init.body !== 'string') {
      throw new Error('Expected the registration request body to be JSON');
    }
    expect(JSON.parse(init.body) as unknown).toEqual({
      email: 'New.Learner@Example.com',
      password: 'safe-test-password',
    });
  });

  it('enforces the backend client-side validation rules', async () => {
    const { user } = renderApp('/register');

    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Email is required.')).toBeVisible();
    expect(screen.getByText('Password is required.')).toBeVisible();

    await user.type(screen.getByLabelText('Email'), 'invalid-email');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Enter a valid email address.')).toBeVisible();
    expect(screen.getByText(/between 8 and 72 characters/i)).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps backend fieldErrors to their registration fields', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        apiError(400, 'Request validation failed', [
          { field: 'email', message: 'Email must be valid' },
          { field: 'password', message: 'Password must contain between 8 and 72 characters' },
        ]),
        400,
      ),
    );
    const { user } = renderApp('/register');

    await fillRegistrationForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Email must be valid')).toBeVisible();
    expect(screen.getByText('Password must contain between 8 and 72 characters')).toBeVisible();
  });

  it('shows a friendly conflict message for an already registered email', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(apiError(409, 'User with this email is already registered'), 409),
    );
    const { user } = renderApp('/register');

    await fillRegistrationForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /account with this email already exists/i,
    );
  });

  it('shows a distinct registration network error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { user } = renderApp('/register');

    await fillRegistrationForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/unable to reach codeprogress/i);
  });

  it('rejects a malformed successful registration response', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: 73, email: 'new.learner@example.com' }, 201),
    );
    const { user } = renderApp('/register');

    await fillRegistrationForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/unexpected response/i);
    expect(screen.getByRole('heading', { name: /join codeprogress/i })).toBeVisible();
  });

  it('disables repeated registration submit while the request is pending', async () => {
    fetchMock.mockImplementationOnce(() => new Promise<Response>(() => undefined));
    const { user } = renderApp('/register');

    await fillRegistrationForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Creating account…' })).toBeDisabled(),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not create an auth session or write credentials to browser storage', async () => {
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
    fetchMock.mockResolvedValueOnce(jsonResponse(createdUserResponse, 201));
    const { user } = renderApp('/register');

    await fillRegistrationForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await screen.findByRole('status');

    expect(authSession.getAccessToken()).toBeNull();
    expect(storageSpy).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(window.location.search).not.toContain('password');
  });

  it('redirects an authenticated user away from /register to /app', () => {
    const authenticatedContext: AuthContextValue = {
      user: createdUserResponse,
      isAuthenticated: true,
      signIn: () => Promise.resolve(),
      logout: () => Promise.resolve(),
    };

    render(
      <MemoryRouter initialEntries={['/register']}>
        <AuthContext.Provider value={authenticatedContext}>
          <AppRoutes />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /you’re signed in/i })).toBeVisible();
    expect(screen.queryByRole('heading', { name: /join codeprogress/i })).not.toBeInTheDocument();
  });

  it('supports keyboard navigation through the registration form', async () => {
    const { user } = renderApp('/register', createTestQueryClient());

    await user.tab();
    expect(screen.getByLabelText('Email')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Password')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Create account' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveFocus();
  });

  it('provides working links between login and registration', async () => {
    const { user } = renderApp('/login');

    await user.click(screen.getByRole('link', { name: 'Create an account' }));
    expect(screen.getByRole('heading', { name: /join codeprogress/i })).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Sign in' }));
    expect(screen.getByRole('heading', { name: /sign in to codeprogress/i })).toBeVisible();
  });
});
