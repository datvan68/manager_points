export const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001').replace(/\/api\/?$/, '');
export const API_BASE = `${API_ORIGIN}/api`;
