import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const headerSource = readFileSync(resolve(__dirname, 'Header.tsx'), 'utf8');

describe('Header responsive shell contract', () => {
  it('uses a sticky, safe-area-aware header without shrinking', () => {
    expect(headerSource).toContain('dashboard-header sticky top-0');
    expect(headerSource).toContain('pt-[env(safe-area-inset-top,0px)]');
    expect(headerSource).toContain('shrink-0');
    expect(headerSource).toContain('min-w-0 w-full');
  });

  it('keeps touched icon actions accessible and keyboard-focusable', () => {
    expect(headerSource).toContain('aria-label="Tìm kiếm"');
    expect(headerSource).toContain('aria-label={`Thông báo');
    expect(headerSource).toContain('aria-label="Quản lý phân hệ"');
    expect(headerSource).toContain('focus-visible:ring-2');
  });

  it('uses valid Vietnamese text for the location success toast', () => {
    expect(headerSource).toContain("toast.success('Đã bật chia sẻ vị trí cho điểm danh.')");
  });
});
