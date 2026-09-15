import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const routes = ['page.tsx', 'record/page.tsx', 'tasks/page.tsx'];

describe('student management navigation order', () => {
  it('puts Ghi nhận before Danh sách for staff while retaining student visibility', () => {
    const sharedTabs = readFileSync(resolve(__dirname, '../../../components/students/StudentSectionTabs.tsx'), 'utf8');
    expect(sharedTabs).toMatch(/Ghi nhận/);
    expect(sharedTabs.indexOf('Ghi nhận')).toBeLessThan(sharedTabs.indexOf('Danh sách'));
    expect(sharedTabs.indexOf('Danh sách')).toBeLessThan(sharedTabs.indexOf('Nhiệm vụ'));

    for (const route of routes) {
      const source = readFileSync(resolve(__dirname, route), 'utf8');
      expect(source).toContain('StudentSectionTabs');
    }
  });
});
