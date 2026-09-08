import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('reports loading contract', () => {
  it('uses one active-tab loader with stale-response protection and retains prior rows', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'page.tsx'), 'utf8');

    expect(source.match(/loadTabSpecificData\(activeTab, true\)/g)).toHaveLength(2);
    expect(source).toContain('if (currentSeq !== requestSeqRef.current) return;');
    expect(source).toContain('if (currentSeq === requestSeqRef.current)');
    expect(source).not.toContain('loadTabSpecificData(activeTab, false)');
  });
});
