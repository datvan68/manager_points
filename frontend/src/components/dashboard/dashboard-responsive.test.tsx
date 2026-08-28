import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (name: string) => readFileSync(resolve(__dirname, name), 'utf8');

describe('dashboard responsive presentation', () => {
  it('uses compact mobile spacing and multi-column icon-led surfaces', () => {
    const page = read('../../app/(dashboard)/page.tsx');
    const kpi = read('KpiGrid.tsx');
    const actions = read('QuickActionsPanel.tsx');

    expect(page).toContain('p-2 sm:p-6');
    expect(page).toContain('space-y-4 sm:space-y-6');
    expect(kpi).toContain('grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4');
    expect(kpi).toContain('hidden sm:block');
    expect(actions).toContain('grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4');
    expect(actions).toContain('hidden sm:inline');
  });

  it('keeps accessible names, touch targets, and visible keyboard focus', () => {
    const header = read('DashboardHeader.tsx');
    const kpi = read('KpiGrid.tsx');
    const actions = read('QuickActionsPanel.tsx');
    const spotlight = read('StudentSpotlightPanel.tsx');

    expect(header).toContain('aria-label="Làm mới dữ liệu"');
    expect(header).toContain('focus-visible:ring-2');
    expect(header).toContain('min-h-11 min-w-11');
    expect(kpi).toContain('aria-label={`${title}: ${value}`}');
    expect(kpi).toContain('min-h-24 sm:min-h-0');
    expect(kpi).toContain('focus-visible:ring-2');
    expect(actions).toContain('aria-label={act.label}');
    expect(actions).toContain('min-h-11');
    expect(actions).toContain('focus-visible:ring-2');
    expect(spotlight).toContain('aria-label={cfg.label}');
    expect(spotlight).toContain('min-h-11');
    expect(spotlight).toContain('hidden sm:inline');
  });

  it('keeps the mobile greeting row compact and uses the Ghi nhận spotlight title', () => {
    const header = read('DashboardHeader.tsx');
    const spotlight = read('StudentSpotlightPanel.tsx');

    expect(header).toContain('grid-cols-[minmax(0,1fr)_auto]');
    expect(header).toContain('col-start-2 row-start-1');
    expect(header).toContain('col-span-2 row-start-2');
    expect(spotlight).toContain('Ghi nhận học sinh sinh viên');
    expect(spotlight).not.toContain('Cập nhật lần cuối:');
    expect(spotlight).not.toContain('Tiêu điểm & Bảng xếp hạng học sinh');
    expect(spotlight).not.toContain('Thống kê hoạt động rèn luyện nổi bật trong học kỳ này');
  });
});
