import { test, expect } from '@playwright/test';

test('B1: Long conversation rendering (DOM limits)', async ({ page }) => {
  await page.route('**/api/chat', async route => {
    await route.fulfill({
      contentType: 'text/event-stream',
      body: 'data: {"chunk":"done"}\n\ndata: [DONE]\n\n'
    });
  });

  await page.goto('/');

  // Open the sidebar if on mobile (or it might be visible on desktop, wait for it)
  // Click the "Massive Conversation" to load it
  await page.getByText('Massive Conversation').click();
  
  // Wait for rendering of the LAST element (which is at the bottom, so it's visible)
  const messages = page.getByText(/^Message \d+:/);
  await expect(messages.last()).toBeVisible();
  
  // Measure how many elements are rendered
  const messageCount = await messages.count();
  console.log(`Rendered ${messageCount} message bubbles.`);
  expect(messageCount).toBeGreaterThan(0);
  expect(messageCount).toBeLessThan(300);
  
  // Scroll to test performance (we just simulate interaction and look for crashes)
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, -1000); // Scroll up
    await page.waitForTimeout(100);
  }
  
  // Try sending a message to see if it responds fast
  const startTime = Date.now();
  await page.fill('textarea', 'New message at the bottom');
  await page.locator('textarea').locator('xpath=..').getByRole('button').last().click();
  
  // Wait for the new message to appear
  await expect(page.getByText('New message at the bottom')).toBeVisible({ timeout: 5000 });
  const endTime = Date.now();
  
  console.log(`Interaction took ${endTime - startTime}ms in a 300-message DOM.`);
  
  // Verify it didn't crash
  expect(await page.locator('textarea').isVisible()).toBe(true);
});
