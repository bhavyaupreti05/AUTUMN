import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  // Override storage state to start unauthenticated
  test.use({ storageState: { cookies: [], origins: [] } });

  test('unauthenticated visit redirects to login, login reaches UI, logout returns to login', async ({ page }) => {
    // 1. Visit root, should redirect to /login
    await page.goto('/');
    await expect(page).toHaveURL(/.*\/login/);

    // 2. Login
    await page.fill('input[placeholder="Username"]', process.env.TEST_USERNAME!);
    await page.fill('input[placeholder="Password"]', process.env.TEST_PASSWORD!);
    await page.click('button:has-text("Log in")');

    // Should redirect back to chat UI
    await expect(page).not.toHaveURL(/.*\/login/);
    await expect(page.getByRole('heading', { name: 'New Chat' })).toBeVisible();

    // 3. Logout
    await page.getByRole('button', { name: 'Log out' }).click();

    // Should redirect back to login
    await expect(page).toHaveURL(/.*\/login/);
  });
});
