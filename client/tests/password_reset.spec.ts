import { test, expect } from '@playwright/test';

const adminUsername = process.env.E2E_ADMIN_USERNAME || 'e2e_admin_user';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || 'E2E-Admin-Password-1';
const normalUsername = process.env.TEST_USERNAME || 'e2e_test_user';
const newPassword = 'E2E-Reset-Password-1';

test('admin issues a reset link and a normal user redeems it', async ({ page }) => {
  await page.goto('/login');

  await page.fill('input[placeholder="Username"]', adminUsername);
  await page.fill('input[placeholder="Password"]', adminPassword);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: 'New Chat' })).toBeVisible();

  await page.getByRole('button', { name: 'Admin Dashboard' }).click();
  await page.getByRole('button', { name: 'User Management' }).click();
  const userRow = page.locator('tr').filter({ hasText: normalUsername });
  await userRow.getByTitle('Reset password').click();
  await page.getByPlaceholder('Your administrator password').fill(adminPassword);
  await page.getByRole('button', { name: 'Issue one-time link' }).click();

  const resetLink = await page.getByTestId('reset-link').innerText();
  const tokenMatch = resetLink.match(/#token=([^\s]+)/);
  expect(tokenMatch).not.toBeNull();
  const token = tokenMatch![1];

  await page.goto('/');
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.goto(`/reset-password#token=${token}`);
  await page.getByRole('textbox', { name: 'New password', exact: true }).fill(newPassword);
  await page.getByPlaceholder('Confirm new password').fill(newPassword);
  const [resetResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/auth/reset-password')),
    page.getByRole('button', { name: 'Reset password' }).click(),
  ]);
  const resetStatus = (await resetResponse).status();
  expect(resetStatus).toBe(200);
  await expect(page).toHaveURL(/.*\/login/);

  await page.fill('input[placeholder="Username"]', normalUsername);
  await page.fill('input[placeholder="Password"]', newPassword);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: 'New Chat' })).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await page.fill('input[placeholder="Username"]', normalUsername);
  await page.fill('input[placeholder="Password"]', process.env.TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText('Incorrect username or password')).toBeVisible();
});