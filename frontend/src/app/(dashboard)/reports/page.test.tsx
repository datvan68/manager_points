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

  it('exports follow-up state and handler fields in the record summary sheet', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'page.tsx'), 'utf8');

    expect(source).toContain("header: 'Trạng thái xử lý'");
    expect(source).toContain("header: 'Số ghi nhận mới'");
    expect(source).toContain("header: 'Thời điểm xử lý'");
    expect(source).toContain("header: 'Người xử lý'");
    expect(source).toContain("new_record_count: Number(row.new_record_count || 0)");
    expect(source).toContain("handled_by_label: row.handled_by || 'Chưa xác định'");
  });

  it('exports only discipline records with the active record filters and recorded_by', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'page.tsx'), 'utf8');

    expect(source).toContain("fullRecords = await fetchAllPagesForExport<any>(");
    expect(source).toContain("const criterionType = record?.criterion_id?.criterion_type;");
    expect(source).toContain("return criterionType === 'ky_luat';");
    expect(source).toContain("header: 'Người ghi nhận'");
    expect(source).toContain("'Chi tiết kỷ luật'");
    expect(source).toContain("followUpStatus: followUpStatus === 'all' ? undefined : followUpStatus");
    expect(source).toContain("filter(record => followUpStudentIds.has(getEntityId(record.student_id)))");
    expect(source).toContain("recorded_by: row?.recorded_by || 'Chưa xác định'");
  });
});
