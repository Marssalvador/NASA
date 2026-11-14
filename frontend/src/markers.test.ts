import { describe, expect, it } from 'vitest';
import { buildMarkers, isDormant } from './lib';
import definitions from '../../data/biomarker_registry.json';
import { bodySites, regionSites } from './anatomyConfig';
import type { Analysis, Biomarker, RiskPathway } from './types';

const def = (id: string, region: string, site: string | null, layer: 1 | 2 = 1) =>
  ({ id, name: id, body_region: region, body_site: site, sensing_layer: layer }) as Biomarker;
const registry = [
  def('a', 'heart', 'heart'),
  def('b', 'heart', 'heart'),
  def('c', 'skeleton', null, 2),
  def('d', 'kidneys', 'kidneys', 2),
];
const analysis = (metric_id: string, status: Analysis['status'], deviation_z: number | null = null) =>
  ({ metric_id, status, deviation_z }) as Analysis;

describe('body markers', () => {
  it('marks only computed deviations, never stable or missing data', () => {
    const m = buildMarkers(
      [analysis('a', 'stable', 1), analysis('d', 'insufficient_data'), analysis('c', 'review', -3.4)],
      registry,
    );
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ site: 'hip', region: 'skeleton', tone: 'alert', title: 'c' });
    expect(m[0].detail).toContain('↓ 3,4 σ');
  });
  it('merges deviations that share an anatomical site', () => {
    const m = buildMarkers([analysis('a', 'review', 3.1), analysis('b', 'review', 4)], registry);
    expect(m).toHaveLength(1);
    expect(m[0].title).toBe('a · b');
  });
  it('adds requested layer-2 acquisitions without hiding deviations', () => {
    const pathways = [
      {
        confirmations: [
          { metric_id: 'd', state: 'requested' },
          { metric_id: 'a', state: 'requested' },
        ],
      },
    ] as RiskPathway[];
    const m = buildMarkers([analysis('a', 'review', 3)], registry, pathways);
    expect(m.map((x) => [x.site, x.tone])).toEqual([
      ['heart', 'alert'],
      ['kidneys', 'request'],
    ]);
  });
  it('every system fallback resolves to a placed anatomical site', () => {
    for (const site of Object.values(regionSites)) expect(bodySites[site]).toBeDefined();
  });
});

describe('hierarchical sensing presentation', () => {
  it('an unrequested, untaken layer-2 acquisition is dormant, not missing data', () => {
    const a = { metric_id: 'c', latest: null } as Analysis;
    expect(isDormant(a, registry)).toBe(true);
    const requested = [{ confirmations: [{ metric_id: 'c', state: 'requested' }] }] as RiskPathway[];
    expect(isDormant(a, registry, requested)).toBe(false);
    expect(isDormant({ metric_id: 'a', latest: null } as Analysis, registry)).toBe(false);
  });
  it('every registry body site has a placed marker anchor', () => {
    for (const d of definitions) expect(bodySites[d.body_site ?? regionSites[d.body_region]], d.id).toBeDefined();
  });
});
