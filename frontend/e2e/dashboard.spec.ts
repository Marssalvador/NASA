import { test, expect } from '@playwright/test';

test('region selection connects humanoid, metrics and chart',async({page})=>{
  await page.goto('/');
  await expect(page.locator('.crew-profile')).toContainText('Alex Morgan');
  await page.getByRole('button',{name:'Seleccionar Cerebro',exact:true}).click();
  await expect(page.locator('.metrics-heading h2')).toHaveText('Cerebro');
  await expect(page.locator('.trend-panel h2')).toContainText('Duración del sueño');
  await page.locator('.system-row').filter({hasText:'Riñones'}).click();
  await expect(page.locator('.metric-cards')).toContainText('CADUCADA');
  await page.getByRole('button',{name:'Ver análisis y procedencia'}).click();
  await expect(page.getByRole('dialog')).toContainText('Incertidumbre');
  await expect(page.getByRole('dialog')).toContainText('Sintética');
});

test('scenario states and emergency protocol are computed',async({page})=>{
  await page.goto('/');
  await page.getByLabel('Seleccionar astronauta',{exact:true}).selectOption('crew-01');
  await expect(page.locator('.crew-panel .evaluation')).toHaveText('Sin desviaciones detectadas');
  await page.getByLabel('Seleccionar astronauta',{exact:true}).selectOption('crew-02');
  await expect(page.locator('.crew-panel .evaluation')).toHaveText('Revisión necesaria');
  await page.getByLabel('Seleccionar astronauta',{exact:true}).selectOption('crew-03');
  await expect(page.locator('.crew-panel .evaluation')).toHaveText('Emergencia por protocolo');
  await page.getByRole('button',{name:'Ver todos',exact:true}).click();
  await expect(page.locator('.emergency-box')).toContainText('chest_pain');
  await expect(page.getByRole('dialog')).toContainText('pending_medical_review');
});

test('replay updates actual samples and evaluations',async({page})=>{
  await page.goto('/');
  await expect(page.locator('.crew-panel .evaluation')).toHaveText('Revisión necesaria');
  const slider=page.getByRole('slider',{name:'Día de misión'});
  await slider.focus();await slider.press('Home');
  await expect(page.locator('.crew-panel .evaluation')).toHaveText('Datos insuficientes');
  await expect(page.locator('.chart-n')).toContainText('n = 1');
  await page.getByRole('button',{name:'Reproducir misión',exact:true}).click();
  await expect(slider).not.toHaveValue('0');
  await page.getByRole('button',{name:'Pausar reproducción',exact:true}).click();
});

test('CSV preview, commit and duplicate detection through UI',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Importar datos',exact:true}).click();
  const dialog=page.getByRole('dialog');
  const stamp=new Date().toISOString();
  await dialog.getByLabel('Archivo de mediciones').setInputFiles({name:'observations.csv',mimeType:'text/csv',buffer:Buffer.from(`timestamp,metric_id,value,unit\n${stamp},heart_rate,73.5,bpm\n`)});
  await dialog.getByRole('button',{name:'Validar y previsualizar'}).click();
  await expect(dialog.getByRole('status')).toContainText('1 nuevas mediciones');
  await dialog.getByRole('button',{name:'Guardar en SQLite'}).click();
  await expect(dialog.getByRole('status')).toContainText('Guardadas 1 mediciones');
  await dialog.getByRole('button',{name:'Cerrar',exact:true}).last().click();
  await expect(page.locator('.metric-card').first()).toContainText('REAL');
  await expect(page.locator('.metric-card').first()).toContainText('73,5');
  await page.getByRole('button',{name:'Importar datos',exact:true}).click();
  await page.getByLabel('Archivo de mediciones').setInputFiles({name:'same.csv',mimeType:'text/csv',buffer:Buffer.from(`timestamp,metric_id,value,unit\n${stamp},heart_rate,73.5,bpm\n`)});
  await page.getByRole('button',{name:'Validar y previsualizar'}).click();
  await expect(page.getByRole('status')).toContainText('1 duplicados existentes');
});

test('all application assets including 3D work without external network',async({page})=>{
  const external:string[]=[], errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{if(new URL(route.request().url()).hostname!=='127.0.0.1'){external.push(route.request().url());return route.abort();}return route.continue();});
  await page.goto('/');
  await page.getByRole('button',{name:'Vista 3D',exact:true}).click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.canvas-caption')).toContainText('arrastra para rotar');
  await page.locator('.system-row').filter({hasText:'Cerebro'}).click();
  await expect(page.locator('.metrics-heading h2')).toHaveText('Cerebro');
  expect(external).toEqual([]);expect(errors).toEqual([]);
});

test('mobile layout stays within the viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await expect(page.locator('.crew-profile')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('.system-row').filter({hasText:'Riñones'}).click();
  await expect(page.locator('.metrics-heading h2')).toHaveText('Riñones');
});
