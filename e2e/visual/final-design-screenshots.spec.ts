import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalOverflow, signIn } from '../support/auth';
import { fakeTask, fakeTopic, installMockApi } from '../support/mockApi';

const session = {
  id: 21,
  topicId: fakeTopic.id,
  sessionDate: '2026-11-14',
  durationMinutes: 90,
  note: 'Practiced accessible forms and keyboard navigation.',
  completedTaskIds: [fakeTask.id],
  createdAt: '2026-11-14T14:00:00',
  updatedAt: '2026-11-14T14:00:00',
};

test.beforeEach(async ({ page }) => {
  await installMockApi(page);
  await page.route('**/api/topics/7/sessions', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([session]),
    }),
  );
  await page.route('**/api/sessions/21', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) }),
  );
});

async function openTopic(page: Page) {
  await signIn(page);
  await page.getByRole('link', { name: 'Topics', exact: true }).click();
  await page.getByRole('link', { name: fakeTopic.title }).click();
  await expect(page.getByRole('heading', { name: fakeTopic.title })).toBeVisible();
}

test('captures final design views and checks overflow', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name.endsWith('mobile');
  const dir = 'docs/screenshots/final-design';
  const capture = async (name: string) => {
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: `${dir}/${name}-${mobile ? 'mobile' : 'desktop'}.png`,
      fullPage: true,
    });
  };

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await capture('login');
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: /progress/i }).first()).toBeVisible();
  await capture('registration');
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Make the next step count.' })).toBeVisible();
  if (!mobile) await capture('dashboard');
  await page.getByRole('link', { name: 'Topics', exact: true }).click();
  if (!mobile) await capture('topics');
  await page.getByRole('link', { name: fakeTopic.title }).click();
  await expect(page.getByRole('heading', { name: 'Learning history' })).toBeVisible();
  const sessionsList = page.getByRole('list', { name: 'Study sessions' });
  await expect(sessionsList.getByText(session.note)).toBeVisible();
  await expect(sessionsList.getByText(fakeTask.title)).toHaveCount(0);
  await expect(sessionsList.getByText('Completed tasks')).toHaveCount(0);
  await capture('topic-details');
  await capture('study-sessions');
  await page.getByRole('button', { name: 'Add session' }).click();
  await expect(page.getByRole('heading', { name: 'Record session' })).toBeVisible();
  await capture('create-study-session');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('link', { name: /View study session/ }).click();
  await expect(page.getByRole('heading', { name: 'Study session', level: 1 })).toBeVisible();
  await expect(page.getByRole('banner').getByText('Study session', { exact: true })).toBeVisible();
  await expect(page.getByText(session.note)).toBeVisible();
  await expect(page.getByText(fakeTask.title)).toHaveCount(0);
  await expect(page.getByText('Completed tasks')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit session' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete study session' })).toBeVisible();
  await capture('study-session-details');
  if (mobile) {
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('radio', { name: 'Русский' }).check();
    await page.goBack();
  } else {
    await page.getByRole('button', { name: 'RU' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Учебное занятие', level: 1 })).toBeVisible();
  await expect(
    page.getByRole('banner').getByText('Учебное занятие', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(session.note)).toBeVisible();
  if (mobile) {
    await page.getByRole('link', { name: 'Настройки' }).click();
    await page.getByRole('radio', { name: 'English' }).check();
    await page.goBack();
  } else {
    await page.getByRole('button', { name: 'EN' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Study session', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Edit session' }).click();
  await expect(page.getByRole('heading', { name: 'Update study session' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Delete study session' }).click();
  const deleteDialog = page.getByRole('dialog', { name: 'Delete study session?' });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(deleteDialog).toHaveCount(0);
  if (!mobile) {
    await page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'Topics' })
      .click();
    await page.getByRole('link', { name: fakeTopic.title }).click();
    await page.getByRole('link', { name: fakeTask.title }).click();
    await capture('learning-task-details');
    await page.getByRole('link', { name: 'Settings' }).click();
    await capture('settings');
  }
});

test('keeps session screens within target viewport widths', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.endsWith('mobile'));
  await openTopic(page);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'Add session' }).click();
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('link', { name: /View study session/ }).click();
    await expectNoHorizontalOverflow(page);
    await expect(
      page.getByRole('banner').getByText('Study session', { exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: fakeTopic.title }).click();
  }
});
