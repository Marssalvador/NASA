import { test, expect } from '@playwright/test';

async function openData(page: import('@playwright/test').Page) {
  await page
    .locator('.anatomy-data-menu')
    .evaluate((el) => ((el as HTMLDetailsElement).open = true));
}

async function open(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.locator('.anatomy-system-heading h1')).toHaveText('Cardiovascular');
  await expect(page.locator('.anatomy-metrics')).toContainText('Frecuencia cardíaca');
}

test('real atlas rotates in overview; a system with media opens it directly over the hidden 3D', async ({
  page,
}) => {
  await open(page);
  await expect(page.locator('.anatomy-canvas[data-ready="true"]')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(700);
  const canvas = page.locator('.anatomy-canvas canvas');
  const bounds = await canvas.boundingBox();
  const before = await canvas.screenshot();
  await page.mouse.move(bounds!.x + bounds!.width * 0.5, bounds!.y + bounds!.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(
    bounds!.x + bounds!.width * 0.5 + 100,
    bounds!.y + bounds!.height * 0.5 + 25,
    { steps: 8 },
  );
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect(await canvas.screenshot()).not.toEqual(before);
  await page.getByRole('button', { name: 'Cardiovascular', exact: true }).click();
  // Direct entry: the image appears at once; the 3D atlas stays mounted (hidden) for the return.
  await expect(page.locator('.anatomy-stage')).toHaveClass(/has-media/);
  await expect(page.locator('.anatomy-stage canvas')).toHaveCount(1);
  await expect(page.locator('.stage-media')).toHaveAttribute('data-shown', 'true');
  await expect(page.locator('.anatomy-stage .system-media-current')).toHaveAttribute(
    'src',
    '/media/systems/heart.webp',
  );
  await expect(page.locator('.system-media-caption')).toHaveCount(0);
  await expect(page.locator('.anatomy-marker')).toHaveCount(0);
  await expect(page.locator('.anatomy-mission-context')).toBeHidden();
  await expect(page.getByRole('region', { name: 'Interpretación del sistema' })).toBeVisible();
  await page.getByRole('button', { name: 'Vista general', exact: true }).click();
  await expect(page.locator('.anatomy-canvas')).toHaveAttribute('data-camera-mode', 'overview');
});

test('systems, missing data, provenance and uncertainty', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Renal', exact: true }).click();
  await expect(page.locator('.anatomy-system-heading h1')).toHaveText('Renal');
  await expect(page.locator('.anatomy-metrics')).toContainText('Medición caducada');
  await page
    .locator('.anatomy-metrics')
    .getByRole('button', { name: /Calcio urinario/ })
    .click();
  await expect(page.getByRole('dialog')).toContainText('Incertidumbre');
  await expect(page.getByRole('dialog')).toContainText('Sintética');
});

test('scenario states and emergency remain independent of the model', async ({ page }) => {
  await open(page);
  const subject = page.getByLabel('Seleccionar astronauta', { exact: true });
  await subject.selectOption('crew-01');
  await expect(page.locator('.anatomy-overall-status')).toHaveText('Sin desviaciones detectadas');
  await subject.selectOption('crew-02');
  await expect(page.locator('.anatomy-overall-status')).toHaveText('Revisión necesaria');
  await subject.selectOption('crew-03');
  await expect(page.locator('.anatomy-overall-status')).toHaveText('Emergencia por protocolo');
  await page.locator('.anatomy-emergency').click();
  await expect(page.locator('.emergency-box')).toContainText('chest_pain');
  await expect(page.getByRole('dialog')).toContainText('pending_medical_review');
});

test('replay recalculates samples and trend', async ({ page }) => {
  await open(page);
  const slider = page.getByRole('slider', { name: 'Día de misión' });
  await slider.focus();
  await slider.press('Home');
  await expect(page.locator('.anatomy-overall-status')).toHaveText('Datos insuficientes');
  await page.getByRole('tab', { name: 'Tendencia', exact: true }).click();
  await expect(page.locator('.anatomy-trend-heading')).toContainText('n = 1');
  await page.getByRole('button', { name: 'Reproducir misión', exact: true }).click();
  await expect(slider).not.toHaveValue('0');
  await page.getByRole('button', { name: 'Pausar reproducción', exact: true }).click();
});

test('CSV preview, commit and duplicate detection use the current subject', async ({ page }) => {
  await open(page);
  await openData(page);
  await page.getByRole('button', { name: 'Importar datos', exact: true }).click();
  const stamp = new Date().toISOString(),
    file = {
      name: 'observations.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(`timestamp,metric_id,value,unit\n${stamp},heart_rate,73.5,bpm\n`),
    };
  await page.getByLabel('Archivo de mediciones').setInputFiles(file);
  await page.getByRole('button', { name: 'Validar y previsualizar' }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('1 nuevas mediciones');
  await page.getByRole('button', { name: 'Guardar en SQLite' }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText(
    'Guardadas 1 mediciones',
  );
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Cerrar', exact: true })
    .last()
    .click();
  await expect(page.locator('.anatomy-metrics')).toContainText('73,5');
  await expect(page.locator('.anatomy-demo-label')).toContainText('reales');
  await openData(page);
  await page.getByRole('button', { name: 'Importar datos', exact: true }).click();
  await page.getByLabel('Archivo de mediciones').setInputFiles(file);
  await page.getByRole('button', { name: 'Validar y previsualizar' }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText(
    '1 duplicados existentes',
  );
});

test('GLB, fonts and decoding work while all external destinations are blocked', async ({
  page,
}) => {
  const external: string[] = [],
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => {
    if (new URL(route.request().url()).hostname !== '127.0.0.1') {
      external.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  await open(page);
  await expect(page.locator('.anatomy-canvas[data-ready="true"]')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Neurológico', exact: true }).click();
  await expect(page.locator('.anatomy-system-heading h1')).toHaveText('Neurológico');
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('layer controls and attribution are accessible', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Control de capas', exact: true }).click();
  const skin = page.getByRole('checkbox', { name: 'Piel', exact: true });
  await skin.uncheck();
  await expect(skin).not.toBeChecked();
  await skin.check();
  await page.getByRole('button', { name: 'Z-Anatomy / BodyParts3D', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('CC BY-SA 4.0');
  await expect(page.getByRole('dialog')).toContainText('CC BY 4.0');
});

test('mobile shows a real 3D body and keeps the page within its viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(page.locator('.anatomy-canvas[data-ready="true"]')).toBeVisible({ timeout: 30000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Renal', exact: true }).click();
  await expect(page.locator('.anatomy-system-heading h1')).toHaveText('Renal');
});

test('no callouts on the body; the sensing ladder explains the next acquisition', async ({
  page,
}) => {
  await open(page);
  await expect(page.locator('.anatomy-canvas[data-ready="true"]')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.anatomy-marker')).toHaveCount(0);
  await expect(page.locator('.anatomy-finding-banner')).toHaveCount(0);
  await expect(page.locator('.anatomy-organ-preview')).toHaveCount(0);
  await page.getByRole('button', { name: 'Óseo', exact: true }).click();
  await expect(page.locator('.anatomy-system-heading h1')).toHaveText('Óseo');
  // No section image yet for this system: it falls back to the 3D camera zoom.
  await expect(page.locator('.stage-media')).toHaveCount(0);
  await expect(page.locator('.anatomy-canvas')).toHaveAttribute('data-camera-mode', 'skeleton');
  await expect(page.locator('.anatomy-marker')).toHaveCount(0);
  const route = page.getByRole('region', { name: 'Ruta Resorción ósea' });
  await expect(route).toContainText('Ruta demostrativa');
  await expect(route).toContainText('Desviada');
  await expect(route).toContainText('Pendiente de revisión médica');
  await expect(page.locator('.anatomy-metrics')).toContainText('Capa 2 · Bajo demanda');
  await page.getByRole('button', { name: 'Vista general', exact: true }).click();
  const subject = page.getByLabel('Seleccionar astronauta', { exact: true });
  await subject.selectOption('crew-01');
  await expect(page.locator('.anatomy-overall-status')).toHaveText('Sin desviaciones detectadas');
  await expect(page.locator('.anatomy-marker')).toHaveCount(0);
});
