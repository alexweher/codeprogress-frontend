import { expect, type Locator, type Page, type Response } from '@playwright/test';

type CreatedResourceKind = 'user' | 'topic' | 'task' | 'session';

const createdResourceIds: Record<CreatedResourceKind, Set<number>> = {
  user: new Set(),
  topic: new Set(),
  task: new Set(),
  session: new Set(),
};

const resourceApiSegments: Record<Exclude<CreatedResourceKind, 'user'>, string> = {
  topic: 'topics',
  task: 'tasks',
  session: 'sessions',
};

export function createSyntheticCredentials() {
  return {
    email: `browser-e2e-${crypto.randomUUID()}@example.test`,
    password: `E2E-${crypto.randomUUID()}!Aa1`,
  };
}

export function localDateInMoscow(offsetDays = 0) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + offsetDays);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  const loginResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/auth/login',
  );
  const meResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/users/me',
  );
  await page.getByRole('button', { name: 'Sign in' }).click();
  expect((await loginResponse).status()).toBe(200);
  expect((await meResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/app$/);
}

export async function expectMutation(
  page: Page,
  method: string,
  path: string,
  expectedStatus: number,
  action: () => Promise<void>,
) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === method && new URL(response.url()).pathname === path,
  );
  await action();
  const response = await responsePromise;
  expect(response.status()).toBe(expectedStatus);
  return response;
}

export async function captureCreatedResourceId(response: Response, kind: CreatedResourceKind) {
  const body: unknown = await response.json();
  if (
    typeof body !== 'object' ||
    body === null ||
    !('id' in body) ||
    typeof body.id !== 'number' ||
    !Number.isSafeInteger(body.id) ||
    body.id <= 0 ||
    createdResourceIds[kind].has(body.id)
  ) {
    throw new Error(`The newly created ${kind} id is missing, invalid, or duplicated.`);
  }
  createdResourceIds[kind].add(body.id);
  return body.id;
}

export function createdResourceApiPath(
  kind: Exclude<CreatedResourceKind, 'user'>,
  id: number,
  suffix = '',
) {
  if (!createdResourceIds[kind].has(id)) {
    throw new Error(`Refusing to mutate a ${kind} that was not created by this test run.`);
  }
  return `/api/${resourceApiSegments[kind]}/${id}${suffix}`;
}

export async function observeGetRequests(page: Page, path: string) {
  let count = 0;
  let heldRequests: Promise<void> | undefined;
  let releaseHeldRequests: (() => void) | undefined;

  await page.route(`**${path}`, async (route) => {
    const request = route.request();
    if (request.method() === 'GET' && new URL(request.url()).pathname === path) {
      count += 1;
      if (heldRequests !== undefined) {
        await heldRequests;
      }
    }
    await route.continue();
  });

  return {
    count: () => count,
    hold() {
      if (heldRequests !== undefined) {
        throw new Error('A request hold is already active.');
      }
      heldRequests = new Promise<void>((resolve) => {
        releaseHeldRequests = resolve;
      });
    },
    release() {
      releaseHeldRequests?.();
      heldRequests = undefined;
      releaseHeldRequests = undefined;
    },
  };
}

export async function expectMetric(page: Page, label: string, value: string | number) {
  const metric = page
    .locator('dl')
    .locator('div')
    .filter({ has: page.locator('dt', { hasText: label }) });
  await expect(metric.locator('dd')).toHaveText(String(value));
}

export async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

export function primaryNavigationLink(page: Page, name: 'Dashboard' | 'Topics') {
  return page
    .getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('link', { name: new RegExp(`^${name}`) });
}

export async function expectDialogKeyboard(dialog: Locator, page: Page, trigger: Locator) {
  const cancel = dialog.getByRole('button', { name: 'Cancel' });
  const confirm = dialog.getByRole('button', { name: 'Delete', exact: true });
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(confirm).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
}

export function historyNavigate(page: Page, path: string) {
  return page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}
