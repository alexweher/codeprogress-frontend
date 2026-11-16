import { expect, test } from '@playwright/test';
import { signIn } from '../support/auth';
import { fakeTask, fakeTopic, installMockApi } from '../support/mockApi';

async function openTopics(page: import('@playwright/test').Page) {
  await installMockApi(page);
  await signIn(page);
  await page.getByRole('link', { name: 'Topics' }).click();
  await expect(page.getByRole('heading', { name: 'My Topics' })).toBeVisible();
}

test('captures Phase B Topics', async ({ page }, testInfo) => {
  await openTopics(page);
  const mobile = testInfo.project.name.endsWith('mobile');
  await page.screenshot({
    path: `docs/screenshots/phase-b/topics-${mobile ? 'mobile' : 'desktop'}.png`,
    fullPage: !mobile,
  });
});

test('captures Phase B Topic details', async ({ page }, testInfo) => {
  await openTopics(page);
  await page.getByRole('link', { name: fakeTopic.title }).click();
  await expect(page.getByRole('heading', { name: fakeTopic.title })).toBeVisible();
  await expect(page.getByText('0/1')).toHaveCount(2);
  const mobile = testInfo.project.name.endsWith('mobile');
  await page.screenshot({
    path: `docs/screenshots/phase-b/topic-details-${mobile ? 'mobile' : 'desktop'}.png`,
    fullPage: true,
  });
});

test('captures Phase B LearningTask details', async ({ page }, testInfo) => {
  await openTopics(page);
  await page.getByRole('link', { name: fakeTopic.title }).click();
  await page.getByRole('link', { name: fakeTask.title }).click();
  await expect(page.getByRole('heading', { name: fakeTask.title })).toBeVisible();
  const mobile = testInfo.project.name.endsWith('mobile');
  await page.screenshot({
    path: `docs/screenshots/phase-b/task-details-${mobile ? 'mobile' : 'desktop'}.png`,
    fullPage: mobile,
  });
});

test('has no page-level overflow at target widths', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phase-a-desktop');
  await openTopics(page);

  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('link', { name: 'Topics', exact: true }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole('link', { name: fakeTopic.title }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole('link', { name: fakeTask.title }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});
