import { useState } from 'react';
import { Upload, CheckCircle2, FileText } from 'lucide-react';
import Modal from './Modal';
import { api, csvRows } from './lib';
import type { Astronaut, Biomarker } from './types';
interface Report {
  valid: boolean;
  rows: number;
  inserted: number;
  duplicates: number;
  errors: { row: number; message: string }[];
  measurements: unknown[];
}
export default function ImportDialog({
  crew,
  subjectId,
  registry,
  onClose,
  onImported,
}: {
  crew: Astronaut[];
  subjectId: string;
  registry: Biomarker[];
  onClose: () => void;
  onImported: () => void;
}) {
  const [subject, setSubject] = useState(subjectId),
    [content, setContent] = useState(''),
    [format, setFormat] = useState('csv'),
    [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]),
    [sample, setSample] = useState<string[][]>([]),
    [timestamp, setTimestamp] = useState('timestamp');
  const [wide, setWide] = useState(false),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [units, setUnits] = useState<Record<string, string>>({});
  const [synthetic, setSynthetic] = useState(false),
    [source, setSource] = useState('Local import'),
    [report, setReport] = useState<Report | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  const reset = () => {
    setReport(null);
    setDone(false);
    setError('');
  };
  async function read(file: File) {
    reset();
    if (file.size > 2_000_000) {
      setError('Maximum file size: 2 MB.');
      return;
    }
    try {
      const text = await file.text();
      const type = file.name.endsWith('.json') ? 'json' : 'csv';
      let rows: string[][];
      if (type === 'json') {
        const data = JSON.parse(text);
        if (!Array.isArray(data) || !data.length)
          throw new Error('A non-empty array of objects is required.');
        const h = Object.keys(data[0]);
        rows = [
          h,
          ...data.slice(0, 5).map((r: Record<string, unknown>) => h.map((k) => String(r[k] ?? ''))),
        ];
      } else rows = csvRows(text);
      setContent(text);
      setFormat(type);
      setFileName(file.name);
      setHeaders(rows[0]);
      setSample(rows.slice(1, 4));
      setWide(!rows[0].includes('metric_id'));
      setMapping({});
      setUnits({});
      setTimestamp(rows[0].includes('timestamp') ? 'timestamp' : rows[0][0]);
    } catch (e) {
      setError(String(e));
    }
  }
  const spec = () => ({
    astronaut_id: subject,
    format,
    content,
    timestamp_column: timestamp,
    mapping: wide ? Object.fromEntries(Object.entries(mapping).filter(([, v]) => v)) : {},
    units,
    source,
    is_synthetic: synthetic,
  });
  async function validate() {
    setBusy(true);
    setError('');
    try {
      if (wide && !Object.values(mapping).some(Boolean))
        throw new Error('Map at least one column to a biomarker.');
      setReport(await api<Report>('/import/preview', spec()));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    setBusy(true);
    setError('');
    try {
      setReport(await api<Report>('/import/commit', spec()));
      setDone(true);
      onImported();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Import measurements" onClose={onClose} wide>
      <p className="muted">
        CSV or JSON · Up to 5,000 rows · One person per import · Dates must include a time zone.
      </p>
      <div className="form-grid">
        <label>
          Astronaut
          <select
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              reset();
            }}
          >
            {crew.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Acquisition source
          <input
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              reset();
            }}
          />
        </label>
      </div>
      <label className="upload-zone">
        <Upload size={26} />
        <strong>{fileName || 'Choose a local file'}</strong>
        <span>CSV / JSON · up to 2 MB</span>
        <input
          type="file"
          accept=".csv,.json"
          aria-label="Measurement file"
          onChange={(e) => {
            if (e.target.files?.[0]) void read(e.target.files[0]);
          }}
        />
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={synthetic}
          onChange={(e) => {
            setSynthetic(e.target.checked);
            reset();
          }}
        />{' '}
        This data is synthetic or simulated
      </label>
      <p className="small muted">
        This label will be preserved. Real and synthetic data are analyzed separately and require
        their own baseline.
      </p>
      {headers.length > 0 && (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {headers.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sample.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-grid">
            <label>
              Timestamp column
              <select
                value={timestamp}
                onChange={(e) => {
                  setTimestamp(e.target.value);
                  reset();
                }}
              >
                {headers.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </label>
            <label>
              Format
              <select
                value={wide ? 'wide' : 'long'}
                onChange={(e) => {
                  setWide(e.target.value === 'wide');
                  reset();
                }}
              >
                <option value="long">One measurement per row (metric_id, value, unit)</option>
                <option value="wide">One variable per column</option>
              </select>
            </label>
          </div>
          {!wide && (
            <p className="small muted">
              Required columns: metric_id, value, unit, and the selected timestamp. Optional:
              astronaut_id, quality, measurement_method, is_synthetic. Row units are validated
              against the registry.
            </p>
          )}
          {wide && (
            <div className="mapping">
              {headers
                .filter(
                  (h) =>
                    ![
                      timestamp,
                      'astronaut_id',
                      'quality',
                      'is_synthetic',
                      'measurement_method',
                    ].includes(h),
                )
                .map((h) => (
                  <div className="mapping-row" key={h}>
                    <span>
                      <FileText size={13} /> {h}
                    </span>
                    <select
                      aria-label={`Map ${h}`}
                      value={mapping[h] || ''}
                      onChange={(e) => {
                        setMapping({ ...mapping, [h]: e.target.value });
                        const d = registry.find((r) => r.id === e.target.value);
                        if (d) setUnits({ ...units, [d.id]: d.unit });
                        reset();
                      }}
                    >
                      <option value="">Ignore column</option>
                      {registry.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    {mapping[h] && (
                      <input
                        aria-label={`Unit for ${h}`}
                        value={units[mapping[h]] || ''}
                        onChange={(e) => {
                          setUnits({ ...units, [mapping[h]]: e.target.value });
                          reset();
                        }}
                      />
                    )}
                  </div>
                ))}
            </div>
          )}
        </>
      )}
      {error && (
        <div role="alert" className="error-box">
          {error}
        </div>
      )}
      {report && (
        <div className={report.valid ? 'success-box' : 'error-box'} role="status">
          {done ? (
            <>
              <CheckCircle2 size={18} /> Saved {report.inserted} measurements. Skipped duplicates:
              {' '}{report.duplicates}.
            </>
          ) : (
            <>
              {report.rows} rows · {report.inserted} new measurements · {report.duplicates}{' '}
              existing duplicates.
              {report.errors.map((e, i) => (
                <p key={i}>
                  Row {e.row}: {e.message}
                </p>
              ))}
            </>
          )}
        </div>
      )}
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>
          {done ? 'Close' : 'Cancel'}
        </button>
        <button
          className="button secondary"
          disabled={!content || busy || done}
          onClick={() => void validate()}
        >
          Validate and preview
        </button>
        <button
          className="button primary"
          disabled={!report?.valid || busy || done}
          onClick={() => void commit()}
        >
          {busy ? 'Processing…' : 'Save to SQLite'}
        </button>
      </div>
    </Modal>
  );
}
