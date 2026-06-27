import { describe, expect, it } from 'vitest';
import { AWS_REGIONS, mergeRegions } from '../src/regions';

describe('regions', () => {
  it('includes common regions', () => {
    expect(AWS_REGIONS).toContain('us-east-1');
    expect(AWS_REGIONS).toContain('eu-west-1');
  });

  it('merges discovered regions, de-duplicates, and sorts', () => {
    const merged = mergeRegions(['us-east-1', 'zz-custom-1']);
    expect(merged).toContain('zz-custom-1');
    expect(merged.filter((r) => r === 'us-east-1')).toHaveLength(1);
    expect([...merged]).toEqual([...merged].sort());
  });
});
