import { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { Location } from '@shared/schema';

// Definición de tipos básicos para Google Maps
interface GoogleMapsApi {
  maps: {
    Map: any;
    Marker: any;
    InfoWindow: any;
    LatLngBounds: any;
    Size: any;
    Point: any;
  };
}

declare const google: GoogleMapsApi;

interface GoogleMapProps {
  locations: Location[];
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
}

// Clave de API de Google Maps - debe configurarse en variables de entorno
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export function GoogleMap({ locations, center, zoom = 13, className = "w-full h-96" }: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar Google Maps API
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setError('Clave de API de Google Maps no configurada');
      return;
    }

    const loader = new Loader({
      apiKey: GOOGLE_MAPS_API_KEY,
      version: 'weekly',
      libraries: ['places']
    });

    loader.load().then(() => {
      setIsLoaded(true);
    }).catch((err) => {
      console.error('Error cargando Google Maps:', err);
      setError('Error al cargar Google Maps');
    });
  }, []);

  // Inicializar mapa
  useEffect(() => {
    if (!isLoaded || !mapRef.current || map) return;

    const defaultCenter = center || { lat: -12.0464, lng: -77.0428 }; // Lima, Perú por defecto

    const newMap = new (google as any).maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: zoom,
      styles: [
        {
          featureType: 'transit',
          elementType: 'geometry',
          stylers: [{ color: '#2f3948' }]
        },
        {
          featureType: 'transit.station',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#d59563' }]
        }
      ]
    });

    setMap(newMap);
  }, [isLoaded, center, zoom, map]);

  // Actualizar marcadores cuando cambien las ubicaciones
  useEffect(() => {
    if (!map || !locations) return;

    // Limpiar marcadores existentes
    markers.forEach(marker => marker.setMap(null));

    // Crear nuevos marcadores
    const newMarkers = locations
      .filter(location => location.isTransmitting && location.latitude && location.longitude)
      .map(location => {
        const position = {
          lat: parseFloat(location.latitude),
          lng: parseFloat(location.longitude)
        };

        const marker = new (google as any).maps.Marker({
          position,
          map,
          title: `Chofer ID: ${location.driverId}`,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="12" fill="#22c55e" stroke="#ffffff" stroke-width="2"/>
                <path d="M10 16l4 4 8-8" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            `),
            scaledSize: new (google as any).maps.Size(32, 32),
            anchor: new (google as any).maps.Point(16, 16)
          }
        });

        // Ventana de información
        const infoWindow = new (google as any).maps.InfoWindow({
          content: `
            <div class="p-3 min-w-48">
              <h3 class="font-semibold text-sm mb-2 text-green-700">🚌 Chofer Activo</h3>
              <div class="space-y-1 text-xs text-gray-600">
                <p><strong>ID Chofer:</strong> ${location.driverId}</p>
                <p><strong>Estado:</strong> <span class="text-green-600 font-semibold">📡 Transmitiendo GPS</span></p>
                <p><strong>Coordenadas GPS Reales:</strong></p>
                <div class="bg-gray-100 p-2 rounded font-mono text-xs">
                   <strong>Latitud:</strong> ${parseFloat(location.latitude).toFixed(8)}<br>
                   <strong>Longitud:</strong> ${parseFloat(location.longitude).toFixed(8)}
                </div>
                <p><strong>Última Actualización:</strong><br>
                   ${new Date(location.timestamp || '').toLocaleString('es-ES')}
                </p>
                <p class="text-blue-600"><strong>📍 Ubicación en tiempo real</strong></p>
              </div>
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });

        return marker;
      });

    setMarkers(newMarkers);

    // Ajustar vista para mostrar todos los marcadores
    if (newMarkers.length > 0) {
      const bounds = new (google as any).maps.LatLngBounds();
      newMarkers.forEach((marker: any) => {
        const position = marker.getPosition();
        if (position) bounds.extend(position);
      });
      map.fitBounds(bounds);
    }
  }, [map, locations]);

  if (error) {
    return (
      <div className={`${className} bg-gray-100 flex items-center justify-center`}>
        <div className="text-center p-4">
          <p className="text-red-600 font-medium">Error con Google Maps</p>
          <p className="text-sm text-gray-600 mt-1">{error}</p>
          <p className="text-xs text-gray-500 mt-2">
            Configure VITE_GOOGLE_MAPS_API_KEY en las variables de entorno
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`${className} bg-gray-100 flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-gray-600 mt-2">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  return <div ref={mapRef} className={className} />;
}