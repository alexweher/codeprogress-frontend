import { screen, waitFor } from '@testing-library/react';
import type { Mock } from 'vitest';
import { authSession } from '../../features/auth/model/authSession';
import { renderApp } from '../../test/renderApp';
import { formatLocalDateForLocale } from './format';
import { LANGUAGE_STORAGE_KEY } from './I18nProvider';

const loginResponse = {
  accessToken: 'i18n-test-token',
  tokenType: 'Bearer',
  expiresIn: 3600,
};

const currentUserResponse = {
  id: 48,
  email: 'locale-test@example.test',
  createdAt: '2026-11-11T10:00:00',
  updatedAt: '2026-11-11T10:00:00',
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('interface localization', () => {
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
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it('switches navigation and Settings between English and Russian without reload', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponse))
      .mockResolvedValueOnce(jsonResponse(currentUserResponse));

    const view = renderApp('/app/settings');
    await view.user.type(screen.getByLabelText('Email'), currentUserResponse.email);
    await view.user.type(screen.getByLabelText('Password'), 'test-password-only');
    await view.user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();

    await view.user.click(screen.getByRole('radio', { name: 'Русский' }));
    expect(screen.getByRole('heading', { name: 'Настройки', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Мой прогресс/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Мои темы/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Выйти' })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('lang', 'ru');

    await view.user.click(screen.getByRole('radio', { name: 'English' }));
    expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();
    await view.user.click(screen.getByRole('radio', { name: 'Русский' }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('ru');
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it('restores the non-secret language preference after a remount', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'ru');
    const firstView = renderApp('/login');
    expect(screen.getByRole('heading', { name: 'Вход в CodeProgress' })).toBeInTheDocument();
    firstView.unmount();

    renderApp('/login');
    expect(screen.getByRole('heading', { name: 'Вход в CodeProgress' })).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement).toHaveAttribute('lang', 'ru'));
    expect(authSession.getAccessToken()).toBeNull();
  });

  it('formats LocalDate in each locale without changing the calendar date', () => {
    const english = formatLocalDateForLocale('2026-12-15', 'en');
    const russian = formatLocalDateForLocale('2026-12-15', 'ru');

    expect(english).toContain('15');
    expect(russian).toContain('15');
    expect(english).not.toBe(russian);
    expect(english).not.toContain('14');
    expect(russian).not.toContain('14');
  });
});
