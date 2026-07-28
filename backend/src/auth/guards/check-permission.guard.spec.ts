import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from '@jest/globals';

const source = readFileSync(resolve(__dirname, 'check-permission.guard.ts'), 'utf8');

describe('checkAnyPermission user-facing messages', () => {
  it('keeps both messages valid UTF-8 Vietnamese', () => {
    expect(source).toContain("message: 'Không thể xác thực người dùng'");
    expect(source).toContain('Bạn không có quyền thực hiện hành động này. Cần một trong các quyền:');
  });
});
