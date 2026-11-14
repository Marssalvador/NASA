/** Reproducible local Chrome measurements. No user data or external services. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const label=process.argv[2]||'measurement',runs=Number(process.argv[3]||3);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=d3d11']});
const results=[];
try {
 for(let i=0;i<runs;i++) {
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const page=await context.newPage();const cdp=await context.newCDPSession(page);
  await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await page.addInitScript(()=>{
   window.__bench={tasks:[],frames:[],lcp:0,sampling:false};
   new PerformanceObserver(list=>{for(const e of list.getEntries())window.__bench.tasks.push(e.duration);}).observe({type:'longtask',buffered:true});
   new PerformanceObserver(list=>{for(const e of list.getEntries())window.__bench.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});
  });
  await page.goto('http://127.0.0.1:8000/?benchmark=1',{waitUntil:'domcontentloaded'});
  await page.locator('.anatomy-canvas[data-ready="true"]').waitFor({timeout:60000});
  await page.locator('.anatomy-metrics').getByText('Frecuencia cardíaca',{exact:true}).waitFor({timeout:30000});
  const readyMs=await page.evaluate(()=>performance.now());
  await page.waitForTimeout(1200);
  const loading=await page.evaluate(()=>({
   navigationMs:performance.getEntriesByType('navigation')[0].responseEnd,
   fcpMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime??null,
   lcpMs:window.__bench.lcp,
   bytes:performance.getEntriesByType('resource').reduce((sum,r)=>sum+r.transferSize,0),
   resources:performance.getEntriesByType('resource').map(r=>({name:r.name.split('/').at(-1),bytes:r.transferSize,durationMs:r.duration})),
   heapMB:performance.memory?performance.memory.usedJSHeapSize/1048576:null,
   longTasks:[...window.__bench.tasks],
  }));
  await page.evaluate(()=>{window.__bench.tasks=[];window.__bench.sampling=true;let last=0;function sample(t){if(!window.__bench.sampling)return;if(last)window.__bench.frames.push(t-last);last=t;requestAnimationFrame(sample);}requestAnimationFrame(sample);});
  const bounds=await page.locator('.anatomy-canvas canvas').boundingBox();
  const start=performance.now();
  const bodyX=1440*.33+137.5;
  await page.mouse.move(bodyX,bounds.y+bounds.height*.46);
  await page.mouse.down();await page.mouse.move(bodyX+200,bounds.y+bounds.height*.46+80,{steps:40});await page.mouse.up();
  const gestureMs=performance.now()-start;
  await page.waitForTimeout(400);
  const interactive=await page.evaluate(()=>{window.__bench.sampling=false;return {frames:window.__bench.frames,longTasks:window.__bench.tasks,stats:window.__AEGIS_PERF__??null};});
  await page.evaluate(()=>{window.__bench.frames=[];window.__bench.sampling=true;window.__bench.resizes=0;let size='';const observer=new ResizeObserver(list=>{for(const e of list){const next=e.contentRect.width+','+e.contentRect.height;if(size&&size!==next)window.__bench.resizes++;size=next;}});observer.observe(document.querySelector('.anatomy-canvas canvas'));let last=0;function sample(t){if(!window.__bench.sampling){observer.disconnect();return;}if(last)window.__bench.frames.push(t-last);last=t;requestAnimationFrame(sample);}requestAnimationFrame(sample);});
  await page.getByRole('button',{name:'Cardiovascular',exact:true}).click();const zoomStart=performance.now();await page.waitForTimeout(800);
  const zoom=await page.evaluate(()=>{window.__bench.sampling=false;return {stats:window.__AEGIS_PERF__??null,frames:window.__bench.frames,canvasResizes:window.__bench.resizes,errors:document.querySelector('.anatomy-load-error')?.textContent??null};});
  const row={run:i+1,readyMs,loading,interactive:{...interactive,gestureMs},zoom:{...zoom,elapsedMs:performance.now()-zoomStart}};
  results.push(row);console.log(label,i+1,JSON.stringify({readyMs,transferMB:loading.bytes/1e6,gestureMs,longTasks:interactive.longTasks.length}));
  await context.close();
 }
} finally {await browser.close();}
const folder=fileURLToPath(new URL('../../docs/performance/',import.meta.url));await mkdir(folder,{recursive:true});
await writeFile(folder+label+'.json',JSON.stringify({label,environment:'Chrome / ANGLE D3D11, 1440×1000 DPR1, cache disabled; localhost; same machine',runs:results},null,2));
