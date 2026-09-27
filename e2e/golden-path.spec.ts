import { expect, test, type Page } from '@playwright/test';

/** Fails the test on CSP violations or uncaught page errors. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /Content Security Policy|Refused to/i.test(m.text())) problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

test('golden path: intro, explore, Bob investigates, the failure, a verified citation, the fix, the numbers', async ({ page }) => {
  test.setTimeout(240_000);
  const problems = watch(page);
  const res = await page.goto('/');
  const headers = res!.headers();
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['content-security-policy']).not.toContain('unsafe-eval');
  expect(headers['content-security-policy']).toMatch(/script-src 'self'( 'sha256-[^']+')*;/);
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBeTruthy();
  expect(headers['permissions-policy']).toContain('camera=()');

  // First run: one line of framing, one primary action.
  await expect(page.getByRole('heading', { name: /Checkout is failing/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Watch Bob solve it' })).toBeVisible();
  await page.getByRole('button', { name: /explore the system yourself/ }).click();

  // The legend explains the visual language once.
  const legend = page.getByRole('dialog', { name: /Your code, drawn to scale/ });
  await expect(legend).toBeVisible();
  await legend.getByRole('button', { name: 'Got it' }).click();
  await expect(legend).toBeHidden();

  // Chapter 1: the living city.
  await expect(page.locator('canvas').first()).toBeVisible();
  await expect(page.getByText('Chapter 1 · Explore the system')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Chapters' }).getByRole('button', { name: /Explore the system/ })).toHaveAttribute('aria-current', 'step');

  // Search finds a symbol.
  await page.keyboard.press('Control+k');
  await page.getByRole('textbox', { name: 'Search query' }).fill('getBillingProfile');
  await expect(page.getByRole('option').first()).toContainText('getBillingProfile');
  await page.keyboard.press('Escape');

  // Chapter 2: Bob investigates (recorded, honestly labelled), then the failure replay.
  await page.getByRole('navigation', { name: 'Chapters' }).getByRole('button', { name: /Watch Bob investigate/ }).click();
  await expect(page.getByRole('status').filter({ hasText: /Real IBM Bob session, recorded .* tool calls .* Bobcoins/ })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Investigation timeline' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Incident ticket' }).first()).toBeVisible();
  await page.getByRole('button', { name: /Skip to the failure/ }).click();
  await expect(page.locator('.label-pill.fail').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Chapter 2 · Root cause')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel(/Grounding score \d+ percent/)).toBeVisible();
  await expect(page).toHaveURL(/c=investigate&m=explain/);

  // Any grounded citation opens the code on the cited line.
  const cite = page.getByRole('button', { name: /:\d+.*, grounded$/ }).first();
  const file = ((await cite.getAttribute('aria-label')) ?? '').split(':')[0]!;
  await cite.click();
  const panel = page.getByRole('dialog', { name: `Source of ${file}` });
  await expect(panel).toBeVisible();
  await expect(panel.locator('.line.hl').first()).toBeVisible();
  await panel.getByRole('button', { name: 'Close code' }).click();

  // Chapter 3: Bob's one-line fix, the healed path, the real numbers.
  await page.getByRole('button', { name: /See the fix/ }).click();
  await expect(page.getByText(/Bob's fix: one line/)).toBeVisible();
  await expect(page.locator('.diff-add').first()).toBeVisible();
  await expect(page.getByText(/Before: 6 of 7 tests pass on main/)).toBeVisible();
  await page.getByRole('button', { name: /Apply the fix and replay/ }).click();
  await expect(page.getByText(/After Bob's fix: 7 of 7 tests pass/)).toBeVisible();
  const impact = page.getByRole('complementary', { name: 'Impact' });
  await expect(impact).toBeVisible();
  await expect(impact).toContainText('1:09');
  await expect(impact).toContainText('99%');
  await expect(page).toHaveURL(/c=fixed&m=healed/);

  expect(problems).toEqual([]);
});

test('2D fallback renders on small screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?c=explore');
  await expect(page.getByRole('img', { name: '2D map of the codebase' })).toBeVisible();
});
