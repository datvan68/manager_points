import { systemApi } from '@/api/system-api';

export type ModuleMaintenanceStates = Record<string, boolean>;

export const MODULE_MAINTENANCE_UPDATED_EVENT = 'module-maintenance-updated';
export const MODULE_MAINTENANCE_CHANNEL = 'module_maintenance_channel';

export const PATH_TO_MODULE_ID: Record<string, string> = {
  '/students/record': 'attendance',
  '/students/tasks': 'events',
  '/tasks': 'events',
  '/students': 'sv-profile',
  '/grading': 'grading',
  '/dormitory': 'dormitory',
  '/activities': 'club',
  '/permissions': 'security',
  '/system': 'config',
  '/reports': 'reports',
  '/notifications': 'notifications',
};

export function getModuleIdByPath(path: string): string | null {
  if (!path) return null;
  // Bỏ query parameters và hash
  let cleanPath = path.split(/[?#]/)[0];
  // Bỏ trailing slash nếu cleanPath có độ dài > 1 và kết thúc bằng '/'
  if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
    cleanPath = cleanPath.slice(0, -1);
  }

  const sortedPaths = Object.keys(PATH_TO_MODULE_ID).sort((a, b) => b.length - a.length);
  for (const routePath of sortedPaths) {
    if (cleanPath === routePath || cleanPath.startsWith(`${routePath}/`)) {
      return PATH_TO_MODULE_ID[routePath];
    }
  }
  return null;
}

export function normalizeModuleMaintenanceStates(value: unknown): ModuleMaintenanceStates {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<ModuleMaintenanceStates>((acc, [key, val]) => {
    if (typeof key === 'string' && key.trim()) {
      acc[key] = val === true;
    }
    return acc;
  }, {});
}

export function getDefaultModuleStatus(moduleId: string): string {
  return moduleId === 'security' ? 'RESTRICTED' : 'ACTIVE';
}

export function applyModuleMaintenanceStates<T extends { id: string; status: string }>(
  modules: T[],
  states: ModuleMaintenanceStates,
): T[] {
  return modules.map((module) => ({
    ...module,
    status: states[module.id] === true ? 'MAINTENANCE' : getDefaultModuleStatus(module.id),
  }));
}

export function notifyModuleMaintenanceUpdated(states: ModuleMaintenanceStates) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent(MODULE_MAINTENANCE_UPDATED_EVENT, { detail: { states } }));

  try {
    const channel = new BroadcastChannel(MODULE_MAINTENANCE_CHANNEL);
    channel.postMessage({ type: MODULE_MAINTENANCE_UPDATED_EVENT, states });
    channel.close();
  } catch {
    // BroadcastChannel is optional; same-tab custom events still keep local UI in sync.
  }
}

export function subscribeModuleMaintenanceUpdates(
  handler: (states: ModuleMaintenanceStates) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};

  const eventListener = (event: Event) => {
    const states = (event as CustomEvent<{ states?: ModuleMaintenanceStates }>).detail?.states;
    if (states) handler(states);
  };

  window.addEventListener(MODULE_MAINTENANCE_UPDATED_EVENT, eventListener);

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(MODULE_MAINTENANCE_CHANNEL);
    channel.onmessage = (event) => {
      if (event.data?.type === MODULE_MAINTENANCE_UPDATED_EVENT && event.data?.states) {
        handler(event.data.states);
      }
    };
  } catch {
    channel = null;
  }

  return () => {
    window.removeEventListener(MODULE_MAINTENANCE_UPDATED_EVENT, eventListener);
    channel?.close();
  };
}

// Short-lived cache for maintenance states
let cachedStates: Record<string, boolean> | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5000; // 5 seconds

export async function getMaintenanceStatesWithCache(): Promise<Record<string, boolean>> {
  const now = Date.now();
  if (cachedStates && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedStates;
  }
  try {
    const response = await systemApi.getModuleMaintenanceStates();
    cachedStates = response.states || {};
    lastFetchTime = now;
    return cachedStates;
  } catch (error) {
    console.error('Failed to fetch maintenance states:', error);
    return cachedStates || {};
  }
}

