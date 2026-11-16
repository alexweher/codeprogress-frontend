import { expect, type Page } from '@playwright/test';

export async function signIn(page: Page, options: { allowImmediateLogout?: boolean } = {}) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('browser.user@example.test');
  await page.getByLabel('Password').fill('Mocked-Password-Only-42!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  if (!options.allowImmediateLogout) {
    await expect(page).toHaveURL(/\/app(?:\/.*)?$/);
  }
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
