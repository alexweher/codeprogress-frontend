import { expect, test } from '@playwright/test';
import { signIn } from '../support/auth';
import { installMockApi } from '../support/mockApi';

test('shows a network error and recovers with Retry', async ({ page }) => {
  const state = await installMockApi(page, { dashboardNetworkError: true });
  await signIn(page);
  await page.getByRole('link', { name: /Dashboard/ }).click();
  await expect(page.getByRole('alert')).toContainText('could not be reached');
  const failedRequests = state.dashboardSummaryRequests;
  state.dashboardAvailable = true;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Make the next step count.' })).toBeVisible();
  await expect.poll(() => state.dashboardSummaryRequests).toBeGreaterThan(failedRequests);
});

test('renders backend fieldErrors accessibly', async ({ page }) => {
  await installMockApi(page, { registerFieldError: true });
  await page.goto('/register');
  await page.getByLabel('Email').fill('rejected@example.test');
  await page.getByLabel('Password').fill('Mocked-Password-Only-42!');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('#register-email-error')).toHaveText('This mocked email is rejected.');
  await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
});

test('rejects a malformed login response without entering a protected route', async ({ page }) => {
  await installMockApi(page, { malformedLogin: true });
  await page.goto('/login');
  await page.getByLabel('Email').fill('browser.user@example.test');
  await page.getByLabel('Password').fill('Mocked-Password-Only-42!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('unexpected response');
  await expect(page).toHaveURL(/\/login$/);
});

test('does not automatically retry an ambiguous DELETE and offers a state check', async ({
  page,
}) => {
  const state = await installMockApi(page, { ambiguousTaskDelete: true });
  await signIn(page);
  await page.getByRole('link', { name: /Topics/ }).click();
  await page.getByRole('link', { name: 'Browser testing foundations' }).click();
  await page.getByRole('link', { name: 'Verify accessible dialogs' }).click();
  await expect(page.getByRole('heading', { name: 'Verify accessible dialogs' })).toBeVisible();
  await page.getByRole('button', { name: 'Task actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete LearningTask' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('cannot confirm whether');
  await expect.poll(() => state.taskDeleteRequests).toBe(1);
  const taskGetsBeforeCheck = state.taskGetRequests;
  await page.getByRole('button', { name: 'Check task state' }).click();
  await expect.poll(() => state.taskGetRequests).toBeGreaterThan(taskGetsBeforeCheck);
  expect(state.taskDeleteRequests).toBe(1);
});
