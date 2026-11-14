import { expect, test, type Page } from '@playwright/test';
import {
  captureCreatedResourceId,
  createdResourceApiPath,
  createSyntheticCredentials,
  expectDialogKeyboard,
  expectMetric,
  expectMutation,
  expectNoHorizontalOverflow,
  historyNavigate,
  localDateInMoscow,
  observeGetRequests,
  primaryNavigationLink,
  signIn,
} from './support';

test.describe.configure({ mode: 'serial' });

const credentials = createSyntheticCredentials();
const runLabel = crypto.randomUUID().slice(0, 8);
const topicTitle = `E2E Topic ${runLabel}`;
const updatedTopicTitle = `E2E Topic updated ${runLabel}`;
const taskATitle = `E2E Task A ${runLabel}`;
const updatedTaskATitle = `E2E Task A updated ${runLabel}`;
const taskBTitle = `E2E Task B ${runLabel}`;
const taskDTitle = `E2E Task D ${runLabel}`;
const sessionDate = localDateInMoscow();
const updatedSessionDate = localDateInMoscow(-1);

let topicId: number;
let taskAId: number;
let taskBId: number;
let taskDId: number;
let sessionId: number;

async function openTopic(page: Page) {
  await primaryNavigationLink(page, 'Topics').click();
  await page.getByRole('link', { name: updatedTopicTitle }).click();
  await expect(page).toHaveURL(new RegExp(`/app/topics/${topicId}$`));
}

async function createTask(page: Page, title: string, difficulty: 'Easy' | 'Medium' | 'Hard') {
  await page.getByRole('button', { name: 'Add task' }).click();
  const form = page
    .getByRole('heading', { name: 'Create learning task' })
    .locator('..')
    .locator('form');
  await form.getByLabel('Title').fill(title);
  await form.getByLabel('Description (optional)').fill(`Synthetic description for ${title}`);
  await form.getByLabel('Difficulty').selectOption({ label: difficulty });
  const createPath = createdResourceApiPath('topic', topicId, '/tasks');
  const response = await expectMutation(page, 'POST', createPath, 201, () =>
    form.getByRole('button', { name: 'Create task' }).click(),
  );
  await expect(page.getByRole('status')).toContainText('Learning task created.');
  return captureCreatedResourceId(response, 'task');
}

function taskCard(page: Page, title: string) {
  return page
    .getByRole('list', { name: 'Learning tasks' })
    .getByRole('listitem')
    .filter({
      has: page.getByRole('link', { name: title }),
    });
}

async function openTopicAction(page: Page, name: string) {
  await page.getByRole('button', { name: 'Topic actions' }).click();
  await page.getByRole('menuitem', { name }).click();
}

async function openTaskAction(page: Page, name: string) {
  await page.getByRole('button', { name: 'Task actions' }).click();
  await page.getByRole('menuitem', { name }).click();
}

async function deleteTask(page: Page, id: number, title: string) {
  const deletePath = createdResourceApiPath('task', id);
  await page.getByRole('link', { name: title }).click();
  await expect(page).toHaveURL(new RegExp(`/app/tasks/${id}$`));
  await openTaskAction(page, 'Delete LearningTask');
  await expectMutation(page, 'DELETE', deletePath, 204, () =>
    page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click(),
  );
  await expect(page.getByRole('status')).toContainText('Learning task deleted successfully.');
}

test('registers one synthetic account and verifies the in-memory auth lifecycle', async ({
  page,
  context,
}) => {
  await page.goto('/app/dashboard');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByRole('link', { name: 'Create an account' }).click();
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  const registrationResponse = await expectMutation(page, 'POST', '/api/auth/register', 201, () =>
    page.getByRole('button', { name: 'Create account' }).click(),
  );
  await captureCreatedResourceId(registrationResponse, 'user');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('status')).toContainText('Account created.');
  await expect(page.getByLabel('Email')).toHaveValue(credentials.email);
  await expect(page.getByLabel('Password')).toHaveValue('');

  await page.getByLabel('Email').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Password')).toBeFocused();
  await page.getByLabel('Password').fill(credentials.password);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeFocused();
  const login = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/auth/login',
  );
  const me = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/users/me',
  );
  await page.keyboard.press('Enter');
  expect((await login).status()).toBe(200);
  expect((await me).status()).toBe(200);
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  expect(
    await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
  ).toEqual({ local: 0, session: 0 });
  expect(await context.cookies()).toEqual([]);
  await expect(page).not.toHaveURL(/token|password|jwt/i);

  await primaryNavigationLink(page, 'Dashboard').click();
  await expectMetric(page, 'Total topics', 0);
  await expectMetric(page, 'Study sessions', 0);
  await expect(
    page
      .getByRole('list', { name: 'Daily study activity for the last 30 days' })
      .getByRole('listitem'),
  ).toHaveCount(30);

  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await signIn(page, credentials.email, credentials.password);

  const topicRequests = await observeGetRequests(page, '/api/topics');
  await primaryNavigationLink(page, 'Topics').click();
  await expect(page.getByRole('heading', { name: 'My Topics' })).toBeVisible();
  await expect(page.getByText('No topics yet', { exact: true })).toBeVisible();
  await expect.poll(topicRequests.count).toBeGreaterThan(0);
  const requestsBeforeLogout = topicRequests.count();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await signIn(page, credentials.email, credentials.password);
  topicRequests.hold();
  try {
    await primaryNavigationLink(page, 'Topics').click();
    await expect.poll(topicRequests.count).toBeGreaterThan(requestsBeforeLogout);
    await expect(page.getByText('Loading topics…', { exact: true })).toBeVisible();
    await expect(page.getByText('No topics yet', { exact: true })).toHaveCount(0);
  } finally {
    topicRequests.release();
  }
  await expect(page.getByText('No topics yet', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Logout' }).click();
});

test('runs the approved Topic, LearningTask, StudySession and Dashboard flow', async ({ page }) => {
  await signIn(page, credentials.email, credentials.password);
  await primaryNavigationLink(page, 'Topics').click();
  await page.getByRole('button', { name: 'Add Topic' }).click();
  const topicCreate = page
    .getByRole('region', { name: 'What will you learn next?' })
    .locator('form');
  await topicCreate.getByRole('textbox', { name: 'Title', exact: true }).fill(topicTitle);
  await topicCreate
    .getByRole('textbox', { name: 'Description (optional)', exact: true })
    .fill('Synthetic real-backend browser E2E topic.');
  const topicResponse = await expectMutation(page, 'POST', '/api/topics', 201, () =>
    topicCreate.getByRole('button', { name: 'Create topic' }).click(),
  );
  topicId = await captureCreatedResourceId(topicResponse, 'topic');
  await page.getByRole('link', { name: topicTitle }).click();
  await expect(page).toHaveURL(new RegExp(`/app/topics/${topicId}$`));

  await openTopicAction(page, 'Edit');
  const topicEdit = page
    .getByRole('heading', { name: 'Update topic' })
    .locator('..')
    .locator('form');
  await topicEdit.getByLabel('Title').fill(updatedTopicTitle);
  await topicEdit.getByLabel('Description (optional)').fill('Updated synthetic topic.');
  await expectMutation(page, 'PUT', createdResourceApiPath('topic', topicId), 200, () =>
    topicEdit.getByRole('button', { name: 'Save changes' }).click(),
  );
  await expect(page.getByRole('heading', { name: updatedTopicTitle })).toBeVisible();

  await openTopicAction(page, 'Change Status');
  const topicStatusForm = page.getByRole('region', { name: 'Change topic status' }).locator('form');
  await topicStatusForm
    .getByRole('combobox', { name: 'Status', exact: true })
    .selectOption('IN_PROGRESS');
  await expectMutation(
    page,
    'PATCH',
    createdResourceApiPath('topic', topicId, '/status'),
    200,
    () => topicStatusForm.getByRole('button', { name: 'Update status' }).click(),
  );
  await expect(page.locator('[data-status="IN_PROGRESS"]')).toContainText('In progress');

  const topicDeleteTrigger = page.getByRole('button', { name: 'Topic actions' });
  await openTopicAction(page, 'Delete Topic');
  await expectDialogKeyboard(
    page.getByRole('dialog', { name: 'Delete Topic?' }),
    page,
    topicDeleteTrigger,
  );

  taskAId = await createTask(page, taskATitle, 'Medium');
  taskBId = await createTask(page, taskBTitle, 'Easy');
  taskDId = await createTask(page, taskDTitle, 'Hard');

  await page.getByRole('link', { name: taskATitle }).click();
  await expect(page).toHaveURL(new RegExp(`/app/tasks/${taskAId}$`));
  await openTaskAction(page, 'Edit details');
  const taskEdit = page
    .getByRole('heading', { name: 'Update learning task' })
    .locator('..')
    .locator('form');
  await taskEdit.getByLabel('Title').fill(updatedTaskATitle);
  await taskEdit.getByLabel('Description (optional)').fill('Updated synthetic task A.');
  await taskEdit.getByLabel('Difficulty').selectOption('HARD');
  await expectMutation(page, 'PUT', createdResourceApiPath('task', taskAId), 200, () =>
    taskEdit.getByRole('button', { name: 'Save details' }).click(),
  );
  await expect(page.getByRole('heading', { name: updatedTaskATitle })).toBeVisible();

  await openTaskAction(page, 'Change status');
  const taskStatusForm = page.getByRole('region', { name: 'Change task status' }).locator('form');
  await taskStatusForm
    .getByRole('combobox', { name: 'Status', exact: true })
    .selectOption('IN_PROGRESS');
  await expectMutation(page, 'PATCH', createdResourceApiPath('task', taskAId, '/status'), 200, () =>
    taskStatusForm.getByRole('button', { name: 'Change status' }).click(),
  );
  await expect(page.locator('[data-status="IN_PROGRESS"]')).toContainText('In progress');

  await openTaskAction(page, 'Edit planning');
  let planningForm = page
    .getByRole('region', { name: 'Update deadline and priority' })
    .locator('form');
  await planningForm.getByLabel('Deadline (optional)', { exact: true }).fill('2026-12-15');
  await planningForm.getByRole('combobox', { name: 'Priority', exact: true }).selectOption('HIGH');
  await expectMutation(
    page,
    'PATCH',
    createdResourceApiPath('task', taskAId, '/planning'),
    200,
    () => planningForm.getByRole('button', { name: 'Save planning' }).click(),
  );
  await openTaskAction(page, 'Edit planning');
  planningForm = page.getByRole('region', { name: 'Update deadline and priority' }).locator('form');
  await planningForm.getByLabel('Deadline (optional)', { exact: true }).fill('');
  await planningForm.getByRole('combobox', { name: 'Priority', exact: true }).selectOption('LOW');
  await expectMutation(
    page,
    'PATCH',
    createdResourceApiPath('task', taskAId, '/planning'),
    200,
    () => planningForm.getByRole('button', { name: 'Save planning' }).click(),
  );
  await expect(page.getByText('No deadline', { exact: true })).toBeVisible();

  const taskDeleteTrigger = page.getByRole('button', { name: 'Task actions' });
  await openTaskAction(page, 'Delete LearningTask');
  await expectDialogKeyboard(
    page.getByRole('dialog', { name: 'Delete LearningTask?' }),
    page,
    taskDeleteTrigger,
  );
  await page.getByRole('link', { name: '← Back to Topic' }).click();
  await deleteTask(page, taskDId, taskDTitle);

  await page.getByRole('button', { name: 'Add session' }).click();
  const sessionForm = page
    .getByRole('heading', { name: 'Record study session' })
    .locator('..')
    .locator('form');
  await sessionForm.getByLabel('Session date').fill(sessionDate);
  await sessionForm.getByLabel('Duration (minutes)').fill('45');
  await sessionForm.getByLabel('Notes (optional)').fill('Synthetic session S1.');
  await sessionForm.getByLabel(new RegExp(updatedTaskATitle)).check();
  await sessionForm.getByLabel(new RegExp(taskBTitle)).check();
  const sessionResponse = await expectMutation(
    page,
    'POST',
    createdResourceApiPath('topic', topicId, '/sessions'),
    201,
    () => sessionForm.getByRole('button', { name: 'Save session' }).click(),
  );
  sessionId = await captureCreatedResourceId(sessionResponse, 'session');
  await expect(taskCard(page, updatedTaskATitle)).toContainText('Completed');
  await expect(taskCard(page, taskBTitle)).toContainText('Completed');

  await primaryNavigationLink(page, 'Dashboard').click();
  await expectMetric(page, 'Total topics', 1);
  await expectMetric(page, 'Completed tasks', 2);
  await expectMetric(page, 'Total study minutes', 45);
  await expectMetric(page, 'Study sessions', 1);
  await expect(
    page.getByRole('listitem', { name: `${sessionDate}: 45 study minutes, 1 sessions` }),
  ).toBeVisible();
  await openTopic(page);

  await page.locator(`a[href="/app/sessions/${sessionId}"]`).click();
  await page.getByRole('button', { name: 'Edit session' }).click();
  const sessionEdit = page
    .getByRole('heading', { name: 'Update study session' })
    .locator('..')
    .locator('form');
  await sessionEdit.getByLabel('Session date').fill(updatedSessionDate);
  await sessionEdit.getByLabel('Duration (minutes)').fill('75');
  await sessionEdit.getByLabel('Notes (optional)').fill('Updated synthetic session S1.');
  await sessionEdit.getByLabel(new RegExp(taskBTitle)).uncheck();
  await expectMutation(page, 'PUT', createdResourceApiPath('session', sessionId), 200, () =>
    sessionEdit.getByRole('button', { name: 'Update session' }).click(),
  );
  await expect(page.getByRole('status')).toContainText('Study session updated.');
  await page.getByRole('link', { name: '← Back to Topic' }).click();
  await expect(taskCard(page, updatedTaskATitle)).toContainText('Completed');
  await expect(taskCard(page, taskBTitle)).toContainText('Planned');

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalOverflow(page);
  await primaryNavigationLink(page, 'Dashboard').click();
  await expectNoHorizontalOverflow(page);
  await expectMetric(page, 'Total study minutes', 75);
  await expect(
    page.getByRole('listitem', { name: `${updatedSessionDate}: 75 study minutes, 1 sessions` }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await openTopic(page);

  await page.locator(`a[href="/app/sessions/${sessionId}"]`).click();
  const sessionDeleteTrigger = page.getByRole('button', { name: 'Delete study session' });
  await sessionDeleteTrigger.click();
  await expectDialogKeyboard(
    page.getByRole('dialog', { name: 'Delete study session?' }),
    page,
    sessionDeleteTrigger,
  );
  await sessionDeleteTrigger.click();
  await expectMutation(page, 'DELETE', createdResourceApiPath('session', sessionId), 204, () =>
    page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click(),
  );
  await expect(page.getByRole('status')).toContainText('Study session deleted successfully.');
  await expect(taskCard(page, updatedTaskATitle)).toContainText('In progress');
  await expect(taskCard(page, taskBTitle)).toContainText('Planned');

  await primaryNavigationLink(page, 'Dashboard').click();
  await expectMetric(page, 'Total study minutes', 0);
  await expectMetric(page, 'Study sessions', 0);
  await openTopic(page);

  await historyNavigate(page, `/app/tasks/${Number.MAX_SAFE_INTEGER}`);
  await expect(
    page.getByRole('heading', { name: 'This learning task is unavailable' }),
  ).toBeVisible();
  await openTopic(page);

  await deleteTask(page, taskAId, updatedTaskATitle);
  await deleteTask(page, taskBId, taskBTitle);
  await openTopicAction(page, 'Delete Topic');
  await expectMutation(page, 'DELETE', createdResourceApiPath('topic', topicId), 204, () =>
    page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click(),
  );
  await expect(page.getByRole('status')).toContainText('Topic deleted successfully.');
  await expect(page.getByRole('link', { name: updatedTopicTitle })).toHaveCount(0);

  await primaryNavigationLink(page, 'Dashboard').click();
  await expectMetric(page, 'Total topics', 0);
  await expectMetric(page, 'Planned tasks', 0);
  await expectMetric(page, 'Active tasks', 0);
  await expectMetric(page, 'Completed tasks', 0);
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
