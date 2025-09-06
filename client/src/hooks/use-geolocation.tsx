import { useEffect, useState, useCallback } from 'react';

// Función para calcular distancia entre dos puntos GPS (en metros)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Radio de la Tierra en metros
  const φ1 = lat1 * Math.PI / 180; // φ, λ en radianes
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const d = R * c; // en metros
  return d;
}

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
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [lastKnownPosition, setLastKnownPosition] = useState<GeolocationPosition | null>(null);

  const handleSuccess = useCallback((position: GeolocationPosition) => {
    const coordinates = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };

    setLastKnownPosition(position);
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

    // Clear watch and interval if there's an error
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    if (intervalId !== null) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
  }, [watchId, intervalId, onError]);

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
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0, // Siempre obtener ubicación fresca
    };

    setState(prev => ({
      ...prev,
      isTransmitting: true,
      error: null,
    }));

    // Función para obtener y enviar ubicación
    const getCurrentLocationAndSend = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('🎯 Actualización de ubicación [', new Date().toLocaleTimeString(), ']:', position.coords);
          console.log('📍 Precisión:', position.coords.accuracy, 'metros');
          handleSuccess(position);
        },
        (error) => {
          console.error('⚠️ Error obteniendo ubicación:', error);
          // Si hay error, usar la última posición conocida
          if (lastKnownPosition) {
            console.log('📍 Usando última ubicación conocida');
            handleSuccess(lastKnownPosition);
          } else {
            handleError(error);
          }
        },
        options
      );
    };

    // Get current position first
    getCurrentLocationAndSend();
    
    // Configurar intervalo para enviar ubicación cada 15 segundos
    const interval = setInterval(() => {
      getCurrentLocationAndSend();
    }, 15000); // 15 segundos
    
    setIntervalId(interval);
    console.log('🚀 Transmisión iniciada: enviando ubicación cada 15 segundos');
        
    // También mantener watchPosition como respaldo para cambios significativos
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        // Solo actualizar si ha habido un cambio significativo en la posición
        if (lastKnownPosition) {
          const distance = calculateDistance(
            lastKnownPosition.coords.latitude,
            lastKnownPosition.coords.longitude,
            pos.coords.latitude,
            pos.coords.longitude
          );
          if (distance > 10) { // Solo si se movió más de 10 metros
            console.log('🏃 Cambio significativo de ubicación detectado (', distance.toFixed(1), 'm)');
            handleSuccess(pos);
          }
        } else {
          handleSuccess(pos);
        }
      },
      handleError,
      options
    );
    
    setWatchId(id);
  }, [state.isSupported, state.isTransmitting, enableHighAccuracy, timeout, maximumAge, handleSuccess, handleError, lastKnownPosition, intervalId]);

  const stopTracking = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }

    if (intervalId !== null) {
      clearInterval(intervalId);
      setIntervalId(null);
    }

    setState(prev => ({
      ...prev,
      isTransmitting: false,
    }));
    
    console.log('🛑 Transmisión detenida');
  }, [watchId, intervalId]);

  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, [watchId, intervalId]);

  return {
    ...state,
    startTracking,
    stopTracking,
  };
}
