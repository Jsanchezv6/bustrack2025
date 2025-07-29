import { useEffect, useState, useCallback } from 'react';

interface GeolocationState {
  coordinates: {
    latitude: number;
    longitude: number;
  } | null;
  isSupported: boolean;
  error: string | null;
  isTransmitting: boolean;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  onLocationUpdate?: (coordinates: { latitude: number; longitude: number }) => void;
  onError?: (error: string) => void;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 30000,
    onLocationUpdate,
    onError,
  } = options;

  const [state, setState] = useState<GeolocationState>({
    coordinates: null,
    isSupported: 'geolocation' in navigator,
    error: null,
    isTransmitting: false,
  });

  const [watchId, setWatchId] = useState<number | null>(null);

  const handleSuccess = useCallback((position: GeolocationPosition) => {
    const coordinates = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };

    setState(prev => ({
      ...prev,
      coordinates,
      error: null,
    }));

    onLocationUpdate?.(coordinates);
  }, [onLocationUpdate]);

  const handleError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = 'Error desconocido al obtener ubicación.';

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Permisos de ubicación denegados.';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Información de ubicación no disponible.';
        break;
      case error.TIMEOUT:
        errorMessage = 'Tiempo de espera agotado al obtener ubicación.';
        break;
    }

    setState(prev => ({
      ...prev,
      error: errorMessage,
      isTransmitting: false,
    }));

    onError?.(errorMessage);

    // Clear watch if there's an error
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  }, [watchId, onError]);

  const startTracking = useCallback(() => {
    if (!state.isSupported) {
      const error = 'La geolocalización no está soportada por este navegador.';
      setState(prev => ({ ...prev, error }));
      onError?.(error);
      return;
    }

    if (state.isTransmitting) {
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy,
      timeout,
      maximumAge,
    };

    // Get current position first
    navigator.geolocation.getCurrentPosition(
      (position) => {
        handleSuccess(position);
        
        // Start watching position
        const id = navigator.geolocation.watchPosition(
          handleSuccess,
          handleError,
          options
        );
        
        setWatchId(id);
        setState(prev => ({
          ...prev,
          isTransmitting: true,
          error: null,
        }));
      },
      handleError,
      options
    );
  }, [state.isSupported, state.isTransmitting, enableHighAccuracy, timeout, maximumAge, handleSuccess, handleError]);

  const stopTracking = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }

    setState(prev => ({
      ...prev,
      isTransmitting: false,
    }));
  }, [watchId]);

  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  return {
    ...state,
    startTracking,
    stopTracking,
  };
}
