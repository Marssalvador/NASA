import { describe, expect, it } from 'vitest';
import { csvRows, regionStatus, fmt } from './lib';
import type { Analysis } from './types';
describe('evaluation presentation', () => {
  it('does not label missing regions stable', () =>
    expect(regionStatus([])).toBe('insufficient_data'));
  it('prioritizes reviews while preserving missing data', () =>
    expect(
      regionStatus([
        { status: 'stable' },
        { status: 'review' },
        { status: 'insufficient_data' },
      ] as Analysis[]),
    ).toBe('review'));
  it('missing values remain missing', () => expect(fmt(null)).toBe('—'));
});
describe('CSV preview', () => {
  it('handles quoted delimiters and escaped quotes', () =>
    expect(csvRows('date,name\n2026,"Vega, ""Elena"""\n')[1]).toEqual(['2026', 'Vega, "Elena"']));
  it('handles semicolon and CRLF', () =>
    expect(csvRows('date;value\r\nnow;72\r\n')[1]).toEqual(['now', '72']));
});
