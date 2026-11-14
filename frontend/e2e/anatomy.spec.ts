import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Iniciar simulación', exact: true })).toBeEnabled();
  await expect(page.locator('.anatomy-metrics')).toContainText('Frecuencia cardíaca');
}
async function state(page: Page) {
  const id = await page.evaluate(() => localStorage.getItem('pulss.presentation.session'));
  return (await page.request.get('/api/v2/demo/sessions/' + id)).json();
}

test('live medical journey: baseline, new signals, test result and original evidence', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await expect(page.locator('.anatomy-canvas[data-ready="true"]')).toBeVisible();
  const basal = await state(page);
  expect(basal.report.assessments.find((a: any) => a.body_region === 'heart').certainty).toBe(
    'observation',
  );
  await page.screenshot({ path: '../docs/visual-review/pulss-basal.png' });
  await page.getByRole('button', { name: 'Cardiovascular', exact: true }).click();
  await page.getByRole('button', { name: 'Iniciar simulación', exact: true }).click();
  await expect(page.locator('.medical-finding[data-certainty="suspicion"]')).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  const pattern = await state(page);
  expect(pattern.measurement_count).toBeGreaterThan(basal.measurement_count);
  expect(pattern.references.hrv).toEqual(basal.references.hrv);
  await page.screenshot({ path: '../docs/visual-review/pulss-pattern.png' });
  await page
    .getByRole('button', { name: 'Registrar resultado de Presión arterial sistólica', exact: true })
    .click();
  await page.getByLabel('Valor de la medición', { exact: true }).fill('140');
  await page.getByRole('button', { name: 'Guardar resultado y reevaluar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.medical-finding[data-certainty="confirmed_finding"]')).toBeVisible();
  const final = await state(page);
  const finding = final.report.assessments.find((a: any) => a.body_region === 'heart');
  expect(finding.supersedes_id).toBeTruthy();
  expect(finding.evidence_ids).toContain(final.last_change.measurement_id);
  await page
    .locator('.medical-finding')
    .getByText(/Evidencias originales/)
    .click();
  await page
    .getByRole('button', { name: 'Medición #' + final.last_change.measurement_id, exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('140 mmHg');
  await expect(page.getByRole('dialog')).toContainText('Sintética');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.screenshot({ path: '../docs/visual-review/pulss-reevaluation.png' });
  expect(errors).toEqual([]);
});

test('manual synthetic measurements and missing quality are stored by the backend', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Introducir medición', exact: true }).click();
  await page.getByLabel('Valor de la medición', { exact: true }).fill('73.5');
  await page.getByRole('button', { name: 'Guardar y evaluar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.anatomy-metrics')).toContainText('73,5');
  let current = await state(page);
  expect(current.latest.find((m: any) => m.biomarker_id === 'heart_rate').value).toBe(73.5);
  await page.getByRole('button', { name: 'Introducir medición', exact: true }).click();
  await page.getByLabel('Calidad de la medición', { exact: true }).selectOption('missing');
  await page.getByRole('button', { name: 'Guardar y evaluar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.anatomy-metrics')).toContainText('Medición ausente');
  current = await state(page);
  expect(current.report.data_states.heart_rate).toBe('missing');
});

test('polling picks up a measurement submitted outside the component', async ({ page }) => {
  await open(page);
  const before = await state(page);
  const response = await page.request.post(
    '/api/v2/demo/sessions/' + before.session_id + '/measurements',
    {
      data: {
        operation_id: 'external',
        expected_revision: before.revision,
        biomarker_id: 'heart_rate',
        value: 77,
        quality: 'good',
      },
    },
  );
  expect(response.status()).toBe(200);
  await expect(page.locator('.anatomy-metrics')).toContainText('77', { timeout: 10000 });
  await page.getByRole('tab', { name: 'Tendencia', exact: true }).click();
  await expect(page.locator('.anatomy-trend-heading')).toContainText('Frecuencia cardíaca');
});

test('reset creates a new scenario and preserves the previous record', async ({ page }) => {
  await open(page);
  const before = await state(page);
  await page.getByRole('button', { name: 'Reiniciar escenario', exact: true }).click();
  await expect.poll(async () => (await state(page)).session_id).not.toBe(before.session_id);
  const after = await state(page);
  expect(after.revision).toBe(0);
  expect(after.step).toBe(0);
  expect((await page.request.get('/api/v2/demo/sessions/' + before.session_id)).status()).toBe(200);
});

test('atlas layers, section media, themes and credits remain available', async ({ page }) => {
  await open(page);
  await expect(page.locator('.anatomy-canvas[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Control de capas', exact: true }).click();
  const skin = page.getByRole('checkbox', { name: 'Piel', exact: true });
  await skin.uncheck();
  await expect(skin).not.toBeChecked();
  await skin.check();
  await page.getByRole('button', { name: 'Cerrar capas', exact: true }).click();
  await page.getByRole('button', { name: 'Cardiovascular', exact: true }).click();
  await expect(page.locator('.anatomy-stage')).toHaveClass(/has-media/);
  await page.getByRole('button', { name: 'Vista general', exact: true }).click();
  await page.getByRole('button', { name: 'Cambiar a tema oscuro', exact: true }).click();
  await expect(page.locator('.anatomy-app')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Z-Anatomy / BodyParts3D', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('CC BY-SA 4.0');
});

test('offline assets and mobile keep the real engine flow available', async ({ page }) => {
  const external: string[] = [];
  await page.route('**/*', (r) => {
    if (new URL(r.request().url()).hostname !== '127.0.0.1') {
      external.push(r.request().url());
      return r.abort();
    }
    return r.continue();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(page.locator('.anatomy-canvas[data-ready="true"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Introducir medición', exact: true }).click();
  await page.getByLabel('Valor de la medición', { exact: true }).fill('72');
  await page.getByRole('button', { name: 'Guardar y evaluar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({ path: '../docs/visual-review/pulss-mobile.png', fullPage: true });
  expect(external).toEqual([]);
});
