import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, signIn } from '../support/auth';
import { installMockApi } from '../support/mockApi';

test('traps dialog focus, closes with Escape and restores trigger focus', async ({ page }) => {
  await installMockApi(page);
  await signIn(page);
  await page.getByRole('link', { name: /Topics/ }).click();
  await page.getByRole('link', { name: 'Browser testing foundations' }).click();
  const trigger = page.getByRole('button', { name: 'Topic actions' });
  await trigger.click();
  await page.getByRole('menuitem', { name: 'Delete Topic' }).click();

  const dialog = page.getByRole('dialog', { name: 'Delete Topic?' });
  const cancel = dialog.getByRole('button', { name: 'Cancel' });
  const remove = dialog.getByRole('button', { name: 'Delete', exact: true });
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(remove).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('keeps login, register, details and long content within the viewport', async ({ page }) => {
  await installMockApi(page);
  await page.goto('/login');
  await expectNoHorizontalOverflow(page);
  await page.getByRole('link', { name: 'Create an account' }).click();
  await expect(page.getByRole('heading', { name: 'Join CodeProgress' })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole('link', { name: 'Sign in' }).click();
  await signIn(page);
  await page.getByRole('link', { name: /Topics/ }).click();
  await page.getByRole('link', { name: 'Browser testing foundations' }).click();
  await expect(page.getByText('A deliberately long synthetic description')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
