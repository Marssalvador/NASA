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
test('rapid section changes settle on the right image without requesting detail GLBs', async ({
  page,
}) => {
  const details: string[] = [];
  const errors: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/models/detail-')) details.push(r.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  const back = page.getByRole('button', { name: 'Vista general', exact: true });
  for (const name of ['Neurológico', 'Óseo', 'Cardiovascular', 'Respiratorio', 'Renal']) {
    await page.getByRole('button', { name, exact: true }).click();
    await back.click();
  }
  await page.getByRole('button', { name: 'Renal', exact: true }).click();
  const image = page.locator('.anatomy-stage .system-media-current');
  await expect(image).toHaveAttribute('src', '/media/systems/kidneys.webp');
  await expect(image).toBeVisible();
  await expect(page.locator('.anatomy-canvas')).toHaveAttribute('data-camera-mode', 'kidneys');
  expect(details).toEqual([]);
  expect(errors).toEqual([]);
});

test('a failed section image is retryable and preserves the information panel', async ({
  page,
}) => {
  let fail = true;
  await page.route('**/media/systems/skeleton.webp', (route) =>
    fail ? route.fulfill({ status: 503, body: 'temporary local failure' }) : route.continue(),
  );
  await ready(page);
  await page.getByRole('button', { name: 'Óseo', exact: true }).click();
  await expect(page.locator('.system-media-error')).toBeVisible();
  await expect(page.locator('.anatomy-metrics')).toBeVisible();
  fail = false;
  await page
    .locator('.system-media-error')
    .getByRole('button', { name: 'Reintentar', exact: true })
    .click();
  await expect(page.locator('.anatomy-stage .system-media-current')).toHaveAttribute(
    'src',
    '/media/systems/skeleton.webp',
  );
  await expect(page.locator('.system-media-error')).toHaveCount(0);
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
