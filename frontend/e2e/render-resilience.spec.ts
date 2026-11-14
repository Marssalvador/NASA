import { test, expect } from '@playwright/test';
async function ready(page: import('@playwright/test').Page) {
  await page.goto('/?benchmark=1');
  await expect(page.locator('.anatomy-canvas[data-ready="true"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.__AEGIS_PERF__?.main))).toBe(true);
}
test('vertical drag and wheel cannot move or incline the body', async ({ page }) => {
  await ready(page);
  const canvas = page.locator('.anatomy-canvas canvas'),
    b = (await canvas.boundingBox())!;
  const before = await page.evaluate(() => window.__AEGIS_PERF__!.main);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 160, { steps: 12 });
  await page.mouse.up();
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(350);
  const after = await page.evaluate(() => window.__AEGIS_PERF__!.main);
  expect(after.target).toEqual(before.target);
  expect(after.camera[1] - after.target[1]).toBeCloseTo(0, 5);
  const distance = (s: typeof before) => Math.hypot(...s.camera.map((v, i) => v - s.target[i]));
  expect(distance(after)).toBeCloseTo(distance(before), 3);
});
test('delayed details and fast region changes preserve a live base model', async ({ page }) => {
  await page.route('**/models/detail-brain.glb', async (route) => {
    await new Promise((r) => setTimeout(r, 1600));
    await route.continue();
  });
  await ready(page);
  await page.getByRole('button', { name: 'Neurológico', exact: true }).click();
  await expect(page.locator('.anatomy-canvas')).toHaveAttribute('data-detail-region', 'overview');
  await expect(page.locator('.anatomy-canvas canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Volver al cuerpo completo', exact: true }).click();
  await page.getByRole('button', { name: 'Renal', exact: true }).click();
  await expect(page.locator('.anatomy-canvas')).toHaveAttribute('data-detail-region', 'kidneys');
  await page.waitForTimeout(1700);
  await expect(page.locator('.anatomy-canvas')).toHaveAttribute('data-detail-region', 'kidneys');
  await expect(page.locator('.anatomy-load-error')).toHaveCount(0);
});
test('failed detail keeps the body visible and can be retried', async ({ page }) => {
  let fail = true;
  await page.route('**/models/detail-skeleton.glb', (route) =>
    fail ? route.fulfill({ status: 503, body: 'temporary local failure' }) : route.continue(),
  );
  await ready(page);
  await page.getByRole('button', { name: 'Óseo', exact: true }).click();
  await expect(page.locator('.anatomy-detail-note')).toContainText('se mantiene la vista ligera');
  await expect(page.locator('.anatomy-canvas canvas')).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.locator('.anatomy-canvas')).toHaveAttribute('data-detail-region', 'skeleton');
  await expect(page.locator('.anatomy-detail-note')).toHaveCount(0);
});
test('a restored WebGL context redraws without replacing the data view', async ({ page }) => {
  await ready(page);
  await page.locator('.anatomy-canvas canvas').evaluate((canvas: HTMLCanvasElement) => {
    const gl = canvas.getContext('webgl2')!;
    const extension = gl.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('Context-loss test extension unavailable');
    extension.loseContext();
    setTimeout(() => extension.restoreContext(), 600);
  });
  await expect(page.locator('.anatomy-detail-note')).toContainText('Restaurando');
  await expect(page.locator('.anatomy-detail-note')).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator('.anatomy-canvas[data-ready="true"]')).toBeVisible();
  await expect(page.locator('.anatomy-metrics')).toContainText('Frecuencia cardíaca');
  await expect(page.locator('.anatomy-load-error')).toHaveCount(0);
});
