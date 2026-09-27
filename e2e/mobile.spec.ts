import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('phone: intro, 2D map, a tapped district as a sheet, and every chapter without sideways scrolling', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Watch Bob solve it' })).toBeVisible();
  await page.getByRole('button', { name: /explore the system yourself/ }).click();
  const legend = page.getByRole('dialog', { name: /Your code, drawn to scale/ });
  await legend.getByRole('button', { name: 'Got it' }).click();

  await expect(page.getByRole('img', { name: '2D map of the codebase' })).toBeVisible();
  await expect(page.getByText('Chapter 1 · Explore the system')).toBeVisible();
  await page.getByRole('button', { name: 'District Payment' }).click();
  const sheet = page.getByRole('complementary', { name: 'Details' });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("From Bob's scan of the code");
  await sheet.getByRole('button', { name: 'Close Details' }).click();

  for (const [url, text] of [
    ['/?c=investigate&m=subagents', /Sends 6 subagents/],
    ['/?c=investigate&m=explain', /Chapter 2 · Root cause/],
    ['/?c=fixed', /Bob's fix: one line/],
    ['/?c=fixed&m=healed', /After Bob's fix: 7 of 7/],
  ] as const) {
    await page.goto(url);
    await expect(page.getByText(text)).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, url).toBeLessThanOrEqual(0);
    const dock = await page.getByRole('region', { name: 'Current chapter' }).boundingBox();
    expect(dock!.x).toBeGreaterThanOrEqual(0);
    expect(dock!.x + dock!.width).toBeLessThanOrEqual(390);
  }

  await page.getByRole('button', { name: 'The numbers' }).click();
  await expect(page.getByRole('complementary', { name: 'Impact' })).toBeVisible();
  await page.getByRole('button', { name: 'More' }).click();
  await expect(page.getByRole('menu', { name: 'More' })).toBeVisible();
  expect(errors).toEqual([]);
});
