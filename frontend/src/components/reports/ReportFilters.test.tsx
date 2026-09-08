import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('report filter disclosure contract', () => {
  it('keeps the filter component stateful and reset-capable when embedded', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'ReportFilters.tsx'), 'utf8');

    expect(source).toContain('onChange({');
    expect(source).toContain('handleResetFilters');
    expect(source).not.toContain('Thống kê & Báo cáo');
    expect(source).toContain('id="reports-filter-panel"');
  });
});
