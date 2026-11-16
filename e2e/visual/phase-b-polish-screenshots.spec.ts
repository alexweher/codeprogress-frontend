import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalOverflow, signIn } from '../support/auth';
import { fakeTask, fakeTopic, installMockApi } from '../support/mockApi';

function screenshotPath(name: string, mobile: boolean) {
  return `docs/screenshots/phase-b-polish/${name}-${mobile ? 'mobile' : 'desktop'}.png`;
}

async function openTopic(page: Page) {
  await page.getByRole('link', { name: 'Topics', exact: true }).click();
  await page.getByRole('link', { name: fakeTopic.title }).click();
  await expect(page.getByRole('heading', { name: fakeTopic.title })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await installMockApi(page);
});

test('captures the polished Russian login', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('codeprogress.language', 'ru'));
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'С возвращением.' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: screenshotPath('login-ru', testInfo.project.name.endsWith('mobile')),
    fullPage: true,
  });
});

test('captures the compact Dashboard', async ({ page }, testInfo) => {
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Make the next step count.' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: screenshotPath('dashboard', testInfo.project.name.endsWith('mobile')),
    fullPage: true,
  });
});

test('captures the compact Topics list', async ({ page }, testInfo) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Topics', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My Topics' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: screenshotPath('topics', testInfo.project.name.endsWith('mobile')),
    fullPage: true,
  });
});

test('captures compact Topic details and its action menu', async ({ page }, testInfo) => {
  await signIn(page);
  await openTopic(page);
  await page.getByRole('button', { name: 'Topic actions' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: screenshotPath('topic-details-menu', testInfo.project.name.endsWith('mobile')),
    fullPage: true,
  });
});

test('captures compact LearningTask details', async ({ page }, testInfo) => {
  await signIn(page);
  await openTopic(page);
  await page.getByRole('link', { name: fakeTask.title }).click();
  await expect(page.getByRole('heading', { name: fakeTask.title })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: screenshotPath('task-details', testInfo.project.name.endsWith('mobile')),
    fullPage: true,
  });
});

test('has no page-level overflow at all target widths', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phase-a-desktop');
  await signIn(page);

  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
    await expectNoHorizontalOverflow(page);
    await page.getByRole('link', { name: 'Topics', exact: true }).click();
    await expectNoHorizontalOverflow(page);
    await page.getByRole('link', { name: fakeTopic.title }).click();
    await expectNoHorizontalOverflow(page);
    await page.getByRole('link', { name: fakeTask.title }).click();
    await expectNoHorizontalOverflow(page);
  }
});
