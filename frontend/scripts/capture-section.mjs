/** Captures the overview, the 3D zoom and the section media of one system (local API on 8001). */
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const out = fileURLToPath(new URL('../../docs/visual-review/', import.meta.url));
const system = process.argv[2] ?? 'Cardiovascular';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });
await page.route('**/*', (r) =>
  new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort(),
);
await page.goto(process.env.AEGIS_URL ?? 'http://127.0.0.1:8001/');
await page.locator('.anatomy-canvas[data-ready="true"]').waitFor({ timeout: 30000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}round4-home.png` });
await page.getByRole('button', { name: system, exact: true }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}round4-zoom.png` });
await page.locator('.stage-media[data-shown="true"]').waitFor();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}round4-section.png` });
console.log('ok');
await browser.close();
