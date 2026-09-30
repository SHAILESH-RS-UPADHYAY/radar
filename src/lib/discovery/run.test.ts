import { describe, expect, it } from 'vitest';
import { ycRows, type YcCompany } from './run';

const yc = (slug: string, all_locations: string, extra: Partial<YcCompany> = {}): YcCompany => ({
  slug,
  name: slug.toUpperCase(),
  website: 'https://' + slug + '.com',
  all_locations,
  status: 'Active',
  ...extra,
});

describe('ycRows', () => {
  it('queues active YC companies by website, your cities and remote first, then India', () => {
    const rows = ycRows(
      [
        yc('blr', 'Bengaluru, Karnataka, India'),
        yc('anywhere', 'Remote'),
        yc('pune', 'Pune, Maharashtra, India'),
        yc('sf', 'San Francisco, CA, USA'),
        yc('gone', 'Remote', { status: 'Inactive' }),
        yc('nosite', 'Remote', { website: null }),
      ],
      ['Bengaluru', 'Remote'],
    );
    expect(rows.map((r) => [r.source_ref, r.priority])).toEqual([
      ['blr', 2],
      ['anywhere', 2],
      ['pune', 1],
      ['sf', 0],
    ]);
    expect(rows[0]).toMatchObject({ source: 'yc', name: 'BLR', website: 'https://blr.com' });
  });
});
