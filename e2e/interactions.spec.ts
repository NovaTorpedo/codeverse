import { expect, test } from '@playwright/test';

test('click anything, understand it: a district in plain language, with its code', async ({ page }) => {
  await page.goto('/?c=explore&n=svc:payment');
  const panel = page.getByRole('complementary', { name: 'Details' });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Payment');
  await expect(panel).toContainText("From Bob's scan of the code");
  await expect(panel.getByText('Talks to')).toBeVisible();
  await panel.getByRole('button', { name: 'Show the code' }).click();
  await expect(page.getByRole('dialog', { name: /Source of demo\/shopfloor\/src\/payment\// })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});

test("a file shows Bob's incident note; the 2D map is keyboard accessible", async ({ page }) => {
  await page.goto('/?c=explore');
  await expect(page.getByText('Chapter 1 · Explore the system')).toBeVisible();
  await page.keyboard.press('m');
  const file = page.getByRole('button', { name: 'File payment.service.ts' });
  await file.focus();
  await page.keyboard.press('Enter');
  const panel = page.getByRole('complementary', { name: 'Details' });
  await expect(panel).toContainText('In the incident');
  await expect(panel).toContainText(/billing is null/);
  await expect(page).toHaveURL(/n=demo%2Fshopfloor%2Fsrc%2Fpayment%2Fpayment\.service\.ts/);
});

test('follow a request hop by hop, with a shareable step', async ({ page }) => {
  await page.goto('/?c=explore');
  await page.getByRole('group', { name: 'Follow a request' }).getByRole('button', { name: 'Checkout', exact: true }).click();
  await expect(page.getByText('Following a request')).toBeVisible();
  await page.getByRole('button', { name: 'Pause' }).click();
  while (!(await page.getByRole('button', { name: 'Previous hop' }).isDisabled())) await page.getByRole('button', { name: 'Previous hop' }).click();
  await expect(page.getByText('1/8')).toBeVisible();
  await page.getByRole('button', { name: 'Next hop' }).click();
  await expect(page.getByText('2/8')).toBeVisible();
  await expect(page.getByText(/Gateway calls Checkout: CheckoutService\.placeOrder\(\)/)).toBeVisible();
  await expect(page).toHaveURL(/flow=checkout&step=1/);
  await page.goto('/?c=explore&flow=checkout&step=5');
  await expect(page.getByText('6/8')).toBeVisible();
  await expect(page.getByText('Payment calls Customer: CustomerService.getBillingProfile().')).toBeVisible();
});

test('deep links open the exact replay moment', async ({ page }) => {
  await page.goto('/?c=investigate&m=rootcause');
  await expect(page.getByText('States the root cause')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /IBM Bob session/ })).toBeVisible();
  await expect(page).toHaveURL(/c=investigate&m=rootcause/);
  await page.goto('/?c=investigate&m=subagents');
  await expect(page.getByText(/Sends 6 subagents/)).toBeVisible();
  await page.goto('/?c=fixed&m=healed');
  await expect(page.getByRole('complementary', { name: 'Impact' })).toBeVisible();
  await page.getByRole('button', { name: 'Copy a link to this moment' }).click();
  await expect(page.getByRole('status').filter({ hasText: /Link to this moment copied|c=fixed/ })).toBeVisible();
});

test('the guided story plays with captions and can be paused, stepped and left', async ({ page }) => {
  await page.goto('/?story=1');
  await expect(page.getByText(/This is Shopfloor, a checkout system drawn from its own code/)).toBeVisible();
  await page.getByRole('button', { name: 'Pause the story' }).click();
  await expect(page.getByRole('button', { name: 'Play the story' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText(/Light travels only along calls the analyzer can prove/)).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText(/The incident: checkout fails for some customers/)).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /IBM Bob session/ })).toBeVisible();
  await page.getByRole('button', { name: 'Explore from here' }).click();
  await expect(page.getByText(/The incident: checkout fails/)).toBeHidden();
});

test('keyboard: chapters, legend and visible focus', async ({ page }) => {
  await page.goto('/?c=explore');
  await expect(page.getByText('Chapter 1 · Explore the system')).toBeVisible();
  await page.keyboard.press('2');
  await expect(page.getByRole('navigation', { name: 'Chapters' }).getByRole('button', { name: /Watch Bob investigate/ })).toHaveAttribute('aria-current', 'step');
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: /Your code, drawn to scale/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /Your code, drawn to scale/ })).toBeHidden();
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el ? getComputedStyle(el).outlineStyle : 'none';
  });
  expect(outline).not.toBe('none');
});

test('reduced motion: the intro appears at once and the replay still reaches the root cause', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Watch Bob solve it' })).toBeVisible({ timeout: 3000 });
  await page.goto('/?c=investigate&m=failure');
  await expect(page.getByText('Chapter 2 · Root cause')).toBeVisible({ timeout: 15_000 });
});
