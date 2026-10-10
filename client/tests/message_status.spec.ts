import { test, expect } from '@playwright/test';

test('message status history renders and error retry sends a new message', async ({ page }) => {
  let retryRequests = 0;
  await page.route('**/api/chat', async route => {
    retryRequests += 1;
    await route.fulfill({
      contentType: 'text/event-stream',
      body: 'data: {"chunk":"Retry response"}\n\ndata: [DONE]\n\n'
    });
  });

  await page.goto('/');
  await page.getByText('Status Messages').click();

  await expect(page.getByText('Partial answer', { exact: true })).toBeVisible();
  await expect(page.getByText('Response was cut off')).toBeVisible();
  await expect(page.getByText("Couldn't generate a response")).toBeVisible();

  await page.getByRole('button', { name: 'Retry' }).click();

  await expect.poll(() => retryRequests).toBe(1);
  await expect(page.getByText('Give me another answer').last()).toBeVisible();
  await expect(page.getByText('Retry response')).toBeVisible();
});