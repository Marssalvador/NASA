import type { Analysis, Biomarker, RiskPathway, Status } from './types';
import { regionSites } from './anatomyConfig';
export const statusText: Record<Status, string> = {
  stable: 'No deviations detected',
  review: 'Review needed',
  emergency: 'Protocol emergency',
  insufficient_data: 'Insufficient data',
};
export const shortStatus: Record<Status, string> = {
  stable: 'No deviations',
  review: 'Review',
  emergency: 'Emergency',
  insufficient_data: 'Not assessed',
};
export const regions = [
  { id: 'heart', name: 'Heart', system: 'Cardiovascular', code: '01' },
  { id: 'lungs', name: 'Lungs', system: 'Respiratory', code: '02' },
  { id: 'brain', name: 'Brain', system: 'Neurological', code: '03' },
  { id: 'muscles', name: 'Muscles', system: 'Muscular', code: '04' },
  { id: 'skeleton', name: 'Skeleton', system: 'Skeletal', code: '05' },
  { id: 'kidneys', name: 'Kidneys', system: 'Renal', code: '06' },
  { id: 'metabolic', name: 'Metabolism and immunity', system: 'Metabolic · immune', code: '07' },
];
export function regionStatus(items: Analysis[]): Status {
  if (!items.length) return 'insufficient_data';
  if (items.some((a) => a.status === 'emergency')) return 'emergency';
  if (items.some((a) => a.status === 'review')) return 'review';
  if (items.some((a) => a.status === 'insufficient_data')) return 'insufficient_data';
  return 'stable';
}
export const fmt = (x: number | null | undefined, digits = 1) =>
  x == null ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(x);
export const dateTime = (x: string) =>
  new Date(x).toLocaleString('en-US', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' UTC';
export async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(
    '/api' + path,
    body === undefined
      ? { signal }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal,
        },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    const detail = typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail);
    throw new Error(`${path}: HTTP ${response.status} ${detail}`);
  }
  return response.json();
}
export function csvRows(text: string): string[][] {
  const first = text.split(/\r?\n/)[0] ?? '';
  const delimiter = first.includes(';') ? ';' : first.includes('\t') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' && !quoted) {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

export interface BodyMarker {
  id: string;
  site: string;
  region: string;
  tone: 'alert' | 'request';
  title: string;
  detail: string;
}
const siteOf = (d: Biomarker) => d.body_site ?? regionSites[d.body_region] ?? d.body_region;
/** Compact display name: keeps acronyms (CTX-I, CRP) unless the full registry name is long. */
export const shortName = (d: Biomarker) => (d.name.length > 26 ? d.name.split(' · ')[0] : d.name);
/**
 * Body markers derived only from computed evaluations and pathway requests.
 * One marker per anatomical site; deviations outrank pending layer-2 requests.
 */
export function buildMarkers(
  analyses: Analysis[],
  registry: Biomarker[],
  pathways: RiskPathway[] = [],
): BodyMarker[] {
  const bySite = new Map<string, BodyMarker>();
  for (const a of analyses) {
    if (a.status !== 'review' && a.status !== 'emergency') continue;
    const d = registry.find((x) => x.id === a.metric_id);
    if (!d) continue;
    const z = a.deviation_z;
    const detail =
      z == null
        ? 'Deviation from personal pattern'
        : `${z > 0 ? '↑' : '↓'} ${fmt(Math.abs(z), 1)} σ from personal pattern`;
    const site = siteOf(d),
      prior = bySite.get(site);
    bySite.set(
      site,
      prior
        ? { ...prior, title: `${prior.title} · ${shortName(d)}`, detail: 'Multiple deviations' }
        : { id: `alert-${site}`, site, region: d.body_region, tone: 'alert', title: shortName(d), detail },
    );
  }
  for (const p of pathways)
    for (const c of p.confirmations) {
      if (c.state !== 'requested') continue;
      const d = registry.find((x) => x.id === c.metric_id);
      if (!d || bySite.has(siteOf(d))) continue;
      bySite.set(siteOf(d), {
        id: `request-${siteOf(d)}`,
        site: siteOf(d),
        region: d.body_region,
        tone: 'request',
        title: shortName(d),
        detail: 'Layer 2 measurement requested',
      });
    }
  return [...bySite.values()];
}

/** Layer-2 acquisitions nobody requested and nobody took. Shown as "not requested", never a gap. */
export function isDormant(a: Analysis, registry: Biomarker[], pathways: RiskPathway[] = []) {
  const d = registry.find((x) => x.id === a.metric_id);
  if (!d || d.sensing_layer !== 2 || a.latest) return false;
  return !pathways.some((p) =>
    p.confirmations.some((c) => c.metric_id === a.metric_id && c.state === 'requested'),
  );
}
