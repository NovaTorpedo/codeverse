import { expect, test } from '@playwright/test';

test('golden path: city renders, incident replay reaches the failure, citations open code', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /Content Security Policy|Refused to/i.test(m.text())) problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

  const res = await page.goto('/');
  const headers = res!.headers();
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['content-security-policy']).not.toContain('unsafe-eval');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBeTruthy();
  expect(headers['permissions-policy']).toContain('camera=()');

  // Living City
  await expect(page.locator('canvas').first()).toBeVisible();
  await expect(page.getByText('Districts', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /Minimap/ })).toBeVisible();

  // Search finds a symbol
  await page.keyboard.press('Control+k');
  await page.getByRole('textbox', { name: 'Search query' }).fill('getBillingProfile');
  await expect(page.getByRole('option').first()).toContainText('getBillingProfile');
  await page.keyboard.press('Escape');

  // Incident: flight recorder then failure replay
  await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Incident' }).click();
  await expect(page.getByRole('region', { name: 'Bob flight recorder' }).or(page.locator('section[aria-label="Bob flight recorder"]'))).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /IBM Bob|SYNTHETIC/ })).toBeVisible();
  await page.getByRole('button', { name: 'Skip to failure replay' }).click();
  await expect(page.getByText('Root cause', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.label-pill.fail').first()).toBeVisible();
  await expect(page.getByLabel(/Grounding score \d+ percent/)).toBeVisible();

  // Citations open the code panel with the cited line highlighted
  // Works for any real Bob investigation: open the first grounded citation that names a line.
  const cite = page.getByRole('button', { name: /:\d+.*, grounded$/ }).first();
  const label = (await cite.getAttribute('aria-label')) ?? '';
  const file = label.split(':')[0]!;
  await cite.click();
  const panel = page.getByRole('dialog', { name: `Source of ${file}` });
  await expect(panel).toBeVisible();
  await expect(panel.locator('.line.hl').first()).toBeVisible();

  expect(problems).toEqual([]);
});

test('2D fallback renders on small screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('img', { name: '2D map of the codebase' })).toBeVisible();
});
