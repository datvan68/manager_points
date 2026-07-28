import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, 'page.tsx'), 'utf8');

describe('Dashboard loading contract', () => {
  it('coalesces concurrent requests for the same semester', () => {
    expect(source).toContain('loadsInFlightRef');
    expect(source).toContain('loadsInFlightRef.current.get(loadKey)');
    expect(source).toContain('loadsInFlightRef.current.set(loadKey, load)');
  });

  it('retains the requested semester in the dashboard API call', () => {
    expect(source).toContain('systemApi.getDashboardMetrics(semIdToLoad || undefined)');
  });
});
