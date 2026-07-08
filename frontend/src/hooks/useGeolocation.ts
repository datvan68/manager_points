'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
  supported: boolean;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watch?: boolean;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 0,
    watch = false,
  } = options;

  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: false,
    supported: typeof navigator !== 'undefined' && 'geolocation' in navigator,
  });

  // Check if user has enabled location sharing from profile toggle
  const isLocationEnabled = typeof window !== 'undefined'
    ? localStorage.getItem('attendance_location_enabled') === 'true'
    : false;

  const watchIdRef = useRef<number | null>(null);

  const handleSuccess = useCallback((position: GeolocationPosition) => {
    setState({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      error: null,
      loading: false,
      supported: true,
    });
  }, []);

  const handleError = useCallback((error: GeolocationPositionError) => {
    let errorMessage: string;
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Quyền truy cập vị trí bị từ chối. Vui lòng bật GPS trong cài đặt.';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Không thể xác định vị trí. Vui lòng kiểm tra GPS.';
        break;
      case error.TIMEOUT:
        errorMessage = 'Yêu cầu vị trí hết thời gian. Vui lòng thử lại.';
        break;
      default:
        errorMessage = 'Lỗi không xác định khi lấy vị trí.';
    }
    setState((prev) => ({
      ...prev,
      error: errorMessage,
      loading: false,
    }));
  }, []);

  const geoOptions: PositionOptions = {
    enableHighAccuracy,
    timeout,
    maximumAge,
  };

  const getCurrentPosition = useCallback(() => {
    if (!state.supported) {
      setState((prev) => ({
        ...prev,
        error: 'Trình duyệt không hỗ trợ Geolocation.',
        loading: false,
      }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      geoOptions,
    );
  }, [state.supported, handleSuccess, handleError]);

  const startWatching = useCallback(() => {
    if (!state.supported) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      geoOptions,
    );
  }, [state.supported, handleSuccess, handleError]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (watch) {
      startWatching();
    }

    return () => {
      stopWatching();
    };
  }, [watch]);

  return {
    ...state,
    getCurrentPosition,
    startWatching,
    stopWatching,
  };
}
