import type { ImpersonationResponse } from '@/api/auth-api';

export const IMPERSONATION_CHANNEL_PREFIX = 'auth_impersonation_handoff_';
export const IMPERSONATION_HANDOFF_TIMEOUT_MS = 15_000;

export type ImpersonationChannelMessage =
  | { type: 'READY'; sessionId: string }
  | { type: 'SUCCESS'; payload: ImpersonationResponse }
  | { type: 'ERROR'; message: string }
  | { type: 'ACK' };

export function createSecureNonce(): string {
  if (typeof crypto === 'undefined') {
    throw new Error('Trình duyệt không hỗ trợ tạo mã bảo mật.');
  }
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  throw new Error('Trình duyệt không hỗ trợ tạo mã bảo mật.');
}

export function getImpersonationChannelName(nonce: string): string {
  return `${IMPERSONATION_CHANNEL_PREFIX}${nonce}`;
}

export function isValidImpersonationNonce(value: string | null): value is string {
  return Boolean(value && /^[A-Za-z0-9_-]{16,128}$/.test(value));
}

export function replaceWindowLocation(path: string): void {
  window.location.replace(path);
}
