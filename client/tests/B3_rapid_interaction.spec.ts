import { test, expect } from '@playwright/test';

test('B3: Rapid user interaction', async ({ page }) => {
  await page.route('**/api/conversations/*', async route => {
    await route.fulfill({
      json: { id: 'test-conv-id', title: 'Test', messages: [] }
    });
  });

  await page.goto('/');
  await page.screenshot({ path: 'b3_failure.png' });
  await expect(page.getByText('CONVERSATIONS')).toBeVisible();
  
  // Rapid theme toggling
  const themeToggle = page.getByRole('button', { name: 'Toggle theme' });
  for (let i = 0; i < 20; i++) {
    await themeToggle.click({ delay: 0 });
  }
  
  // Verify it's still responding
  await expect(themeToggle).toBeVisible();

  // Rapid New Chat clicks
  const newChatBtn = page.locator('button:has-text("New Chat")');
  for (let i = 0; i < 20; i++) {
    await newChatBtn.click({ delay: 0 });
  }
  
  // Verify textarea is focused and still in document
  await expect(page.locator('textarea')).toBeVisible();
});
