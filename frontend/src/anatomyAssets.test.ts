import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import manifest from '../public/models/anatomy-manifest.json';
import { cameraTargets } from './anatomyConfig';
import runtime from '../../assets/models/runtime/runtime-manifest.json';

describe('licensed anatomy asset contract', () => {
  it('keeps the initial body within geometry and download budgets', () => {
    const overview = runtime.models.find((m) => m.region === 'overview')!;
    expect(overview.triangles).toBeLessThan(300000);
    expect(overview.bytes).toBeLessThan(2500000);
    expect(runtime.models.find((m) => m.region === 'heart')!.bytes).toBeLessThan(250000);
  });
  it('provides a local detail asset for every selectable system', () => {
    for (const id of ['heart', 'lungs', 'kidneys', 'brain', 'muscles', 'skeleton', 'metabolic']) {
      const detail = runtime.models.find((m) => m.region === id)!;
      expect(detail).toBeDefined();
      const b = readFileSync(
        new URL(`../../assets/models/runtime/${detail.file}`, import.meta.url),
      );
      expect(b.subarray(0, 4).toString()).toBe('glTF');
    }
  });
  it('contains real mesh regions and anatomically bounded camera targets', () => {
    const regions = new Set(manifest.pieces.map((p) => p.region));
    for (const id of [
      'heart',
      'lungs',
      'kidneys',
      'brain',
      'muscles',
      'skeleton',
      'metabolic',
      'skin',
    ])
      expect(regions.has(id)).toBe(true);
    expect(manifest.pieces.reduce((n, p) => n + p.triangles, 0)).toBeGreaterThan(100000);
    for (const [key, pose] of Object.entries(cameraTargets)) {
      expect(pose.target[1]).toBeGreaterThanOrEqual(manifest.bounds.min[1]);
      expect(pose.target[1]).toBeLessThanOrEqual(manifest.bounds.max[1]);
      expect(pose.position.every(Number.isFinite), key).toBe(true);
    }
  });
  it('keeps the isolated heart within the thorax instead of including distant vessels', () => {
    const heart = manifest.parts.filter((p) => p.tissue.startsWith('cardiac'));
    expect(heart.length).toBeGreaterThan(5);
    for (const part of heart) {
      expect(part.bounds.min[1], part.name).toBeGreaterThan(1.15);
      expect(part.bounds.max[1], part.name).toBeLessThan(1.55);
    }
  });
  it('replaces restricted atlas kidneys and omits inner-ear meshes', () => {
    const originalKidneys = manifest.parts.filter(
      (p) => p.source === 'VisceralSystem100' && /kidney/i.test(p.name),
    );
    expect(originalKidneys).toHaveLength(0);
    expect(manifest.parts.filter((p) => p.tissue === 'kidney')).toHaveLength(2);
    expect(manifest.excluded.some((p) => p.reason === 'upstream licence exception')).toBe(true);
    expect(manifest.parts.some((p) => /cochlea|semicircular duct|vestibule/i.test(p.name))).toBe(
      false,
    );
  });
  it('ships an actual self-contained binary glTF with local decoder compression', () => {
    const buffer = readFileSync(new URL('../../assets/models/humanoid.glb', import.meta.url));
    expect(buffer.subarray(0, 4).toString()).toBe('glTF');
    const json = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString());
    expect(json.meshes.length).toBeGreaterThan(10);
    expect(json.extensionsRequired).toContain('EXT_meshopt_compression');
    expect(json.buffers.every((b: { uri?: string }) => !b.uri)).toBe(true);
    expect(json.images ?? []).toHaveLength(0);
  });
});
