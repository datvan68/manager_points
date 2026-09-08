import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('reports loading contract', () => {
  it('uses one active-tab loader with stale-response protection and retains prior rows', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'page.tsx'), 'utf8');

    expect(source.match(/loadTabSpecificData\(activeTab, true\)/g)).toHaveLength(2);
    expect(source).toContain('activeTab,\n    activePaginationKey,');
    expect(source).toContain('onChange={handleFiltersChange}');
    expect(source).not.toContain('prevFiltersRef');
    expect(source).toContain('if (currentSeq !== requestSeqRef.current) return;');
    expect(source).toContain('if (currentSeq === requestSeqRef.current)');
    expect(source).not.toContain('loadTabSpecificData(activeTab, false)');
  });

  it('requests grouped records with active filters and stores aggregate metadata for both KPI loaders', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'page.tsx'), 'utf8');

    expect(source.match(/groupBy: 'student'/g)).toHaveLength(3);
    expect(source).toContain('semesterId: filters.semesterId');
    expect(source).toContain('classId: filters.classId');
    expect(source).toContain('departmentId: filters.departmentId');
    expect(source).toContain('status: filters.status');
    expect(source).toContain('search: filters.searchQuery');
    expect(source).toContain('startDate: filters.startDate');
    expect(source).toContain('endDate: filters.endDate');
    expect(source).toContain('academicRecordAggregates: recordMeta ? {');
    expect(source).toContain("academicRecordAggregates: recordsRes && 'meta' in recordsRes ? {");
    expect(source.match(/attentionStudentCount: Number\(/g)).toHaveLength(2);
    expect(source.match(/if \(currentSeq !== requestSeqRef\.current\) return;/g)?.length).toBeGreaterThanOrEqual(5);
  });
});
