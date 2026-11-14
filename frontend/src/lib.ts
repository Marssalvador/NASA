import type { Analysis, Status } from './types';
export const statusText:Record<Status,string> = {stable:'Sin desviaciones detectadas',review:'Revisión necesaria',emergency:'Emergencia por protocolo',insufficient_data:'Datos insuficientes'};
export const shortStatus:Record<Status,string> = {stable:'Sin desviaciones',review:'Revisión',emergency:'Emergencia',insufficient_data:'Sin evaluar'};
export const regions = [
  {id:'heart',name:'Corazón',system:'Cardiovascular',code:'01'}, {id:'lungs',name:'Pulmones',system:'Respiratorio',code:'02'},
  {id:'brain',name:'Cerebro',system:'Neurológico',code:'03'}, {id:'muscles',name:'Músculos',system:'Muscular',code:'04'},
  {id:'skeleton',name:'Esqueleto',system:'Óseo',code:'05'}, {id:'kidneys',name:'Riñones',system:'Renal',code:'06'},
  {id:'metabolic',name:'Metabolismo e inmunidad',system:'Metabólico · inmune',code:'07'},
];
export function regionStatus(items:Analysis[]):Status {
  if (!items.length) return 'insufficient_data';
  if (items.some(a=>a.status==='emergency')) return 'emergency';
  if (items.some(a=>a.status==='review')) return 'review';
  if (items.some(a=>a.status==='insufficient_data')) return 'insufficient_data';
  return 'stable';
}
export const fmt = (x:number|null|undefined, digits=1) => x == null ? '—' : new Intl.NumberFormat('es-ES',{maximumFractionDigits:digits}).format(x);
export const dateTime = (x:string) => new Date(x).toLocaleString('es-ES',{timeZone:'UTC',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})+' UTC';
export async function api<T>(path:string, body?:unknown, signal?:AbortSignal):Promise<T> {
  const response = await fetch('/api'+path, body === undefined ? {signal} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
  if (!response.ok) {const error=await response.json().catch(()=>({detail:response.statusText})); throw new Error(typeof error.detail==='string'?error.detail:JSON.stringify(error.detail));}
  return response.json();
}
export function csvRows(text:string):string[][] {
  const first=text.split(/\r?\n/)[0] ?? '';
  const delimiter=first.includes(';')?';':first.includes('\t')?'\t':',';
  const rows:string[][]=[]; let row:string[]=[], cell='', quoted=false;
  for(let i=0;i<text.length;i++) {const c=text[i];
    if(c==='"') {if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(c===delimiter&&!quoted){row.push(cell);cell='';}
    else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}
  return rows;
}
