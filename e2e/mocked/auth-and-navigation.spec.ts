import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, signIn } from '../support/auth';
import { freshSessionTopic, installMockApi } from '../support/mockApi';

test('protects app routes, signs in, navigates, logs out and clears user cache', async ({
  page,
}) => {
  const state = await installMockApi(page);
  await page.goto('/app/topics');
  await expect(page).toHaveURL(/\/login$/);

  await signIn(page);
  await page.getByRole('link', { name: /Topics/ }).click();
  await expect(page.getByRole('heading', { name: 'My Topics' })).toBeVisible();
  await page.getByRole('link', { name: 'Browser testing foundations' }).click();
  await expect(page.getByRole('heading', { name: 'Browser testing foundations' })).toBeVisible();
  await page.getByRole('link', { name: 'Verify accessible dialogs' }).click();
  await expect(page.getByRole('heading', { name: 'Verify accessible dialogs' })).toBeVisible();

  const topicsRequestsBeforeLogout = state.topicsRequests;

  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/app/topics');
  await expect(page).toHaveURL(/\/login$/);

  state.setTopicsResponse([freshSessionTopic]);
  state.pauseTopicsResponses();

  await signIn(page);
  try {
    await page.getByRole('link', { name: /Topics/ }).click();
    await expect.poll(() => state.topicsRequests).toBeGreaterThan(topicsRequestsBeforeLogout);
    await expect(page.getByRole('link', { name: 'Browser testing foundations' })).toHaveCount(0);
  } finally {
    state.resumeTopicsResponses();
  }

  await expect(page.getByRole('link', { name: freshSessionTopic.title })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Browser testing foundations' })).toHaveCount(0);
});

test('handles authenticated HTTP 401 with safe global logout', async ({ page }) => {
  await installMockApi(page, { protected401Path: '/api/dashboard/summary' });
  await signIn(page, { allowImmediateLogout: true });
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/app/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});

test('does not persist mocked JWT or password in browser storage, cookies or URL', async ({
  page,
  context,
}) => {
  await installMockApi(page);
  await signIn(page);
  expect(
    await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
  ).toEqual({ local: 0, session: 0 });
  expect(await context.cookies()).toEqual([]);
  await expect(page).not.toHaveURL(/mocked|password|jwt/i);
});

test('supports primary navigation without horizontal overflow', async ({ page }) => {
  await installMockApi(page);
  await signIn(page);
  await expectNoHorizontalOverflow(page);
  await page.getByRole('link', { name: /Dashboard/ }).click();
  await expect(page.getByRole('heading', { name: 'Make the next step count.' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole('link', { name: /Topics/ }).click();
  await expect(page.getByRole('heading', { name: 'My Topics' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('switches to Russian without reload and restores the preference after reload', async ({
  page,
}) => {
  await installMockApi(page);
  await signIn(page);

  await page.getByRole('link', { name: /Settings/ }).click();
  await page.getByRole('radio', { name: 'Русский' }).click();

  await expect(page.getByRole('heading', { name: 'Настройки', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /Мой прогресс/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Мои темы/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Вход в CodeProgress' })).toBeVisible();
  await page.getByLabel('Электронная почта').fill('browser.user@example.test');
  await page.getByLabel('Пароль').fill('Mocked-Password-Only-42!');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL(/\/app\/settings$/);
  await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible();

  expect(
    await page.evaluate(() => ({
      language: localStorage.getItem('codeprogress.language'),
      accessToken: localStorage.getItem('accessToken'),
      sessionEntries: sessionStorage.length,
    })),
  ).toEqual({ language: 'ru', accessToken: null, sessionEntries: 0 });
  await expectNoHorizontalOverflow(page);
});
