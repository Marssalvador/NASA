import { useState } from 'react';
import { Upload, CheckCircle2, FileText } from 'lucide-react';
import Modal from './Modal';
import { api, csvRows } from './lib';
import type { Astronaut, Biomarker } from './types';
interface Report {valid:boolean;rows:number;inserted:number;duplicates:number;errors:{row:number;message:string}[];measurements:unknown[]}
export default function ImportDialog({crew,subjectId,registry,onClose,onImported}:{crew:Astronaut[];subjectId:string;registry:Biomarker[];onClose:()=>void;onImported:()=>void}) {
  const [subject,setSubject]=useState(subjectId),[content,setContent]=useState(''),[format,setFormat]=useState('csv'),[fileName,setFileName]=useState('');
  const [headers,setHeaders]=useState<string[]>([]),[sample,setSample]=useState<string[][]>([]),[timestamp,setTimestamp]=useState('timestamp');
  const [wide,setWide]=useState(false),[mapping,setMapping]=useState<Record<string,string>>({}),[units,setUnits]=useState<Record<string,string>>({});
  const [synthetic,setSynthetic]=useState(false),[source,setSource]=useState('Importación local'),[report,setReport]=useState<Report|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false);
  const reset=()=>{setReport(null);setDone(false);setError('');};
  async function read(file:File) {reset();if(file.size>2_000_000){setError('Tamaño máximo: 2 MB.');return;}try{
    const text=await file.text();const type=file.name.endsWith('.json')?'json':'csv';let rows:string[][];
    if(type==='json'){const data=JSON.parse(text);if(!Array.isArray(data)||!data.length)throw new Error('Se requiere un array de objetos.');const h=Object.keys(data[0]);rows=[h,...data.slice(0,5).map((r:Record<string,unknown>)=>h.map(k=>String(r[k]??'')))];}else rows=csvRows(text);
    setContent(text);setFormat(type);setFileName(file.name);setHeaders(rows[0]);setSample(rows.slice(1,4));setWide(!rows[0].includes('metric_id'));setMapping({});setUnits({});setTimestamp(rows[0].includes('timestamp')?'timestamp':rows[0][0]);
  }catch(e){setError(String(e));}}
  const spec=()=>({astronaut_id:subject,format,content,timestamp_column:timestamp,mapping:wide?Object.fromEntries(Object.entries(mapping).filter(([,v])=>v)):{},units,source,is_synthetic:synthetic});
  async function validate(){setBusy(true);setError('');try {if(wide&&!Object.values(mapping).some(Boolean))throw new Error('Asocia al menos una columna a un biomarcador.');setReport(await api<Report>('/import/preview',spec()));}catch(e){setError(String(e));}finally{setBusy(false);}}
  async function commit(){setBusy(true);setError('');try{setReport(await api<Report>('/import/commit',spec()));setDone(true);onImported();}catch(e){setError(String(e));}finally{setBusy(false);}}
  return <Modal title="Importar mediciones" onClose={onClose} wide><p className="muted">CSV o JSON · Máximo 5000 filas · Una persona por importación · Las fechas requieren zona horaria.</p>
    <div className="form-grid"><label>Astronauta<select value={subject} onChange={e=>{setSubject(e.target.value);reset();}}>{crew.map(c=><option key={c.id} value={c.id}>{c.name} · {c.id}</option>)}</select></label><label>Origen de la adquisición<input value={source} onChange={e=>{setSource(e.target.value);reset();}}/></label></div>
    <label className="upload-zone"><Upload size={26}/><strong>{fileName||'Selecciona un archivo local'}</strong><span>CSV / JSON · hasta 2 MB</span><input type="file" accept=".csv,.json" aria-label="Archivo de mediciones" onChange={e=>{if(e.target.files?.[0])void read(e.target.files[0]);}}/></label>
    <label className="checkbox"><input type="checkbox" checked={synthetic} onChange={e=>{setSynthetic(e.target.checked);reset();}}/> Estos datos son sintéticos o simulados</label><p className="small muted">Se conservará esta etiqueta. Los datos reales se analizan separados de los sintéticos y necesitan su propio baseline.</p>
    {headers.length>0&&<><div className="table-scroll"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{sample.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>
      <div className="form-grid"><label>Columna de fecha<select value={timestamp} onChange={e=>{setTimestamp(e.target.value);reset();}}>{headers.map(h=><option key={h}>{h}</option>)}</select></label><label>Organización<select value={wide?'wide':'long'} onChange={e=>{setWide(e.target.value==='wide');reset();}}><option value="long">Una medición por fila (metric_id, value, unit)</option><option value="wide">Una variable por columna</option></select></label></div>
      {!wide&&<p className="small muted">Columnas requeridas: metric_id, value, unit y la fecha seleccionada. Opcionales: astronaut_id, quality, measurement_method, is_synthetic. Las unidades de cada fila se validan contra el registro.</p>}
      {wide&&<div className="mapping">{headers.filter(h=>![timestamp,'astronaut_id','quality','is_synthetic','measurement_method'].includes(h)).map(h=><div className="mapping-row" key={h}><span><FileText size={13}/> {h}</span><select aria-label={`Asociar ${h}`} value={mapping[h]||''} onChange={e=>{setMapping({...mapping,[h]:e.target.value});const d=registry.find(r=>r.id===e.target.value);if(d)setUnits({...units,[d.id]:d.unit});reset();}}><option value="">Ignorar columna</option>{registry.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select>{mapping[h]&&<input aria-label={`Unidad ${h}`} value={units[mapping[h]]||''} onChange={e=>{setUnits({...units,[mapping[h]]:e.target.value});reset();}}/>}</div>)}</div>}
    </>}
    {error&&<div role="alert" className="error-box">{error}</div>}{report&&<div className={report.valid?'success-box':'error-box'} role="status">{done?<><CheckCircle2 size={18}/> Guardadas {report.inserted} mediciones. Duplicados omitidos: {report.duplicates}.</>:<>{report.rows} filas · {report.inserted} nuevas mediciones · {report.duplicates} duplicados existentes.{report.errors.map((e,i)=><p key={i}>Fila {e.row}: {e.message}</p>)}</>}</div>}
    <div className="modal-actions"><button className="button secondary" onClick={onClose}>{done?'Cerrar':'Cancelar'}</button><button className="button secondary" disabled={!content||busy||done} onClick={()=>void validate()}>Validar y previsualizar</button><button className="button primary" disabled={!report?.valid||busy||done} onClick={()=>void commit()}>{busy?'Procesando…':'Guardar en SQLite'}</button></div>
  </Modal>;
}
