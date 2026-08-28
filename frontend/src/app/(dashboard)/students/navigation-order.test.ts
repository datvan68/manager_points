import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const routes = [
  'page.tsx',
  'record/page.tsx',
  'tasks/page.tsx',
];

describe('student management navigation order', () => {
  it('puts Ghi nhận before Danh sách for staff while retaining student visibility', () => {
    for (const route of routes) {
      const source = readFileSync(resolve(__dirname, route), 'utf8');
      const staffTabs = source.match(/: \[\s*\{ id: ["']Ghi nhận["'][\s\S]*?\{ id: ["']Nhiệm vụ["'][\s\S]*?\]/)?.[0];

      expect(staffTabs).toBeTruthy();
      expect(staffTabs!.indexOf('Ghi nhận')).toBeLessThan(staffTabs!.indexOf('Danh sách'));
      expect(source).toMatch(/\{ id: ["']Ghi nhận["'], label: ["']Ghi nhận["'] \}/);
      expect(source).toMatch(/\{ id: ["']Nhiệm vụ["'], label: ["']Nhiệm vụ["'] \}/);
    }
  });
});
