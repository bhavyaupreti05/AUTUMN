import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/');
  // Fill in the username and password from environment variables
  await page.fill('input[placeholder="Username"]', process.env.TEST_USERNAME!);
  await page.fill('input[placeholder="Password"]', process.env.TEST_PASSWORD!);
  await page.click('button:has-text("Log in")');
  
  // Wait until the URL changes or a main UI element appears
  await expect(page.getByRole('heading', { name: 'New Chat' })).toBeVisible();
  
  // Save storage state to a file
  await page.context().storageState({ path: authFile });
});
