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

    console.log('GPS - Nuevas coordenadas obtenidas:', coordinates);

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

    setState(prev => ({
      ...prev,
      isTransmitting: true,
      error: null,
    }));

    // Configuración para obtener ubicación GPS real
    const gpsOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 60000, // 60 segundos
      maximumAge: 0,   // No usar caché, siempre obtener ubicación fresca
    };

    // Get current position first - FORZAR GPS REAL
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('GPS REAL obtenido:', position.coords);
        handleSuccess(position);
        
        // Start watching position con GPS real
        const id = navigator.geolocation.watchPosition(
          (pos) => {
            console.log('Actualización GPS REAL:', pos.coords);
            handleSuccess(pos);
          },
          handleError,
          gpsOptions
        );
        
        setWatchId(id);
      },
      (error) => {
        console.error('Error obteniendo GPS:', error);
        handleError(error);
      },
      gpsOptions
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
