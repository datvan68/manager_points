export function maskLoginKey(loginKey: string | null | undefined): string {
  if (!loginKey) return '';
  const trimmed = loginKey.trim();
  if (!trimmed) return '';

  if (trimmed.includes('@')) {
    const [localPart, domain] = trimmed.split('@');
    if (localPart.length <= 2) {
      return `${localPart[0] || ''}***@${domain}`;
    }
    return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
  }

  if (trimmed.length <= 4) {
    return '***';
  }
  return `${trimmed.slice(0, 3)}***${trimmed.slice(-2)}`;
}
