export const AUTO_EVENT_PAGES = ['/students/record', '/grading/score'];

export function normalizeLinkedPath(linkedPage?: string | null): string {
  if (!linkedPage) return '';
  let path = linkedPage.split('?')[0].trim();
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  return path;
}

export function isAutoEventPath(path: string): boolean {
  return AUTO_EVENT_PAGES.some((page) => path === page || path.startsWith(`${page}/`));
}

export function getLinkedTaskMode(linkedPage?: string | null): 'none' | 'auto' | 'manual' {
  const path = normalizeLinkedPath(linkedPage);
  if (!path) return 'none';
  return isAutoEventPath(path) ? 'auto' : 'manual';
}
