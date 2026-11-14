/** Captures the overview, the 3D zoom and the section media of one system (local API on 8001). */
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const out = fileURLToPath(new URL('../../docs/visual-review/', import.meta.url));
const system = process.argv[2] ?? 'Cardiovascular';
const slug = process.argv[3] ?? 'section';
const prefix = process.env.CAPTURE_PREFIX ?? 'round5';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });
await page.route('**/*', (r) =>
  new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort(),
);
await page.goto(process.env.AEGIS_URL ?? 'http://127.0.0.1:8001/');
await page.locator('.anatomy-canvas[data-ready="true"]').waitFor({ timeout: 30000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}${prefix}-home.png` });
await page.getByRole('button', { name: system, exact: true }).click();
await page.waitForTimeout(800);
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}${prefix}-${slug}.png` });
console.log('ok');
await browser.close();
