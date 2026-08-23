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

  it('removes the impersonation banner while keeping the menu exit action', () => {
    expect(headerSource).not.toContain('Đang truy cập với tư cách');
    expect(headerSource).toContain("user?.impersonation ? 'Kết thúc truy cập' : 'Đăng xuất'");
    expect(headerSource).toContain('logout();');
  });

  it('guides denied location permissions to browser or iOS settings', () => {
    expect(headerSource).toContain("if (permission === 'denied')");
    expect(headerSource).toContain('Cài đặt > Safari > Vị trí');
  });

  it('declares mobile zoom and header drag protections in the global shell styles', () => {
    const globalStyles = readFileSync(resolve(__dirname, '../../globals.css'), 'utf8');

    expect(globalStyles).toContain('font-size: 16px !important');
    expect(globalStyles).toContain('overscroll-behavior: contain');
    expect(globalStyles).toContain('position: fixed');
    expect(globalStyles).toContain('bottom: calc(var(--safe-area-bottom) + 0.25rem)');
    expect(globalStyles).toContain('width: min(calc(100vw - 1rem), 340px)');
    expect(globalStyles).toContain('height: 54px');
    expect(globalStyles).toContain('touch-action: none');
  });
});
