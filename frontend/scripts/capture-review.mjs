/** Visual review captures of the built app against a disposable local API (port 8001). */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../../docs/visual-review/', import.meta.url));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11'] });
const base = process.env.AEGIS_URL ?? 'http://127.0.0.1:8001/';

async function shot(name, { width = 1672, height = 941, act } = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.route('**/*', (r) =>
    new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort(),
  );
  await page.goto(base);
  await page.locator('.anatomy-canvas[data-ready="true"]').waitFor({ timeout: 30000 });
  await page.waitForTimeout(600);
  if (act) await act(page);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}${name}.png` });
  await page.close();
  console.log(name);
}

await shot('round3-home');
await shot('round3-skeleton', {
  act: (p) => p.getByRole('button', { name: 'Óseo', exact: true }).click(),
});
await shot('round3-cardiovascular', {
  act: (p) => p.getByRole('button', { name: 'Cardiovascular', exact: true }).click(),
});
await shot('round3-posterior', {
  act: (p) => p.getByRole('button', { name: 'Vista posterior', exact: true }).click(),
});
await shot('round3-mobile', { width: 390, height: 844 });
await browser.close();
