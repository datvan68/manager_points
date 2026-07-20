'use client';

import { useCallback, useEffect, useState } from 'react';

export type LocationPermissionState = 'unsupported' | 'requesting' | 'granted' | 'denied' | 'prompt';

export function useLocationPermission() {
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const [permission, setPermission] = useState<LocationPermissionState>(supported ? 'prompt' : 'unsupported');
  useEffect(() => {
    if (!supported || !navigator.permissions) return;
    let status: PermissionStatus | undefined;
    let disposed = false;
    const sync = () => { if (!disposed && status) setPermission(status.state as LocationPermissionState); };
    void navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      if (disposed) return;
      status = result;
      setPermission(result.state as LocationPermissionState);
      result.addEventListener('change', sync);
    }).catch(() => undefined);
    return () => { disposed = true; status?.removeEventListener('change', sync); };
  }, [supported]);
  const requestPermission = useCallback(() => {
    if (!supported) { setPermission('unsupported'); return Promise.resolve('unsupported' as const); }
    setPermission('requesting');
    return new Promise<LocationPermissionState>((resolve) => navigator.geolocation.getCurrentPosition(
      () => { setPermission('granted'); resolve('granted'); },
      (error) => { const next = error.code === error.PERMISSION_DENIED ? 'denied' : 'prompt'; setPermission(next); resolve(next); },
      { enableHighAccuracy: true, timeout: 10000 },
    ));
  }, [supported]);
  return { permission, supported, granted: permission === 'granted', requesting: permission === 'requesting', requestPermission };
}
