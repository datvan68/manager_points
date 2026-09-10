import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, 'StudentSpotlightPanel.tsx'), 'utf8');

describe('Student spotlight pagination and virtualization contract', () => {
  it('loads each category independently and preserves loaded rows on retry', () => {
    expect(source).toContain('getStudentHighlights');
    expect(source).toContain('requestsRef');
    expect(source).toContain('new Set(prior.map(item => item.studentId))');
    expect(source).toContain('hasMore');
    expect(source).toContain('category.error && category.items.length > 0');
    expect(source).toContain("highlightMode !== 'staff'");
    expect(source).toContain("if (highlightMode === 'hidden') return null;");
  });

  it('uses bounded variable-height virtualization for both layouts', () => {
    expect(source).toContain('useVirtualizer');
    expect(source).toContain('measureElement');
    expect(source).toContain('overscan: 6');
    expect(source).toContain('VirtualHighlightList');
    expect(source).toContain('categories[category.id].total');
  });

  it('renders actionable discipline status and delta fields', () => {
    expect(source).toContain('Kỷ luật cần xử lý');
    expect(source).toContain('followUpStatus === \'new\'');
    expect(source).toContain('followUpStatus');
    expect(source).toContain('Ghi nhận mới');
    expect(source).toContain('Số lần ghi nhận:');
    expect(source).toContain('Điểm trừ:');
    expect(source).not.toContain('Điểm trừ mới:');
    expect(source).not.toContain('Chưa xử lý');
    expect(source).not.toContain('Tổng học kỳ');
  });
});
