import { expect, test } from '@playwright/test';
import { signIn } from '../support/auth';
import { installMockApi } from '../support/mockApi';

test('captures the Phase A dashboard', async ({ page }, testInfo) => {
  await installMockApi(page);
  await signIn(page);
  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Make the next step count.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Verify accessible dialogs' })).toBeVisible();

  const suffix = testInfo.project.name.endsWith('mobile') ? 'mobile' : 'desktop';
  await page.screenshot({
    path: `docs/screenshots/phase-a-dashboard-${suffix}.png`,
    fullPage: suffix === 'desktop',
  });
});

test('keeps the dashboard inside key viewport widths', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phase-a-desktop');
  await installMockApi(page);
  await signIn(page);
  await page.getByRole('link', { name: 'Dashboard' }).click();

  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { name: 'Make the next step count.' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});
