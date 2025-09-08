import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWebSocket } from "@/hooks/use-websocket";
import { queryClient } from "@/lib/queryClient";
import { Route as RouteType, Location, User, Assignment } from "@shared/schema";
import { GoogleMap } from "@/components/google-map";
import { 
  Bus, 
  MapPin, 
  Calendar, 
  AlertTriangle,
  Clock,
  Circle,
  Home,
  Route,
  Info
} from "lucide-react";

export default function PassengerDashboard() {
  const [activeLocations, setActiveLocations] = useState<Location[]>([]);
  const [mapCenter, setMapCenter] = useState({ lat: 14.6349, lng: -90.5069 }); // Guatemala City
  const [mapZoom, setMapZoom] = useState(11);
  const [activeTab, setActiveTab] = useState("mapa");
  const mapRef = useRef<any>(null);

  // WebSocket para actualizaciones en tiempo real
  useWebSocket({
    onMessage: (message) => {
      if (message.type === 'locationUpdate') {
        setActiveLocations(prev => {
          const updated = [...prev];
          const index = updated.findIndex(loc => loc.driverId === message.data.driverId);
          if (index >= 0) {
            updated[index] = message.data;
          } else {
            updated.push(message.data);
          }
          return updated;
        });
      }
      
      if (message.type === 'transmissionStatusUpdate' || 
          message.type === 'transmissionStatus' || 
          message.type === 'transmissionStopped') {
        queryClient.invalidateQueries({ queryKey: ['/api/locations'] });
        queryClient.refetchQueries({ queryKey: ['/api/locations'] });
      }
    }
  });

  // Obtener datos públicos
  const { data: routes = [], isLoading: routesLoading } = useQuery<RouteType[]>({
    queryKey: ['/api/schedules'], // Usando el endpoint existente
  });

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['/api/locations'],
    refetchInterval: 5000, // Actualizar cada 5 segundos
  });

  const { data: drivers = [] } = useQuery<User[]>({
    queryKey: ['/api/drivers'],
  });

  const { data: assignments = [] } = useQuery<Assignment[]>({
    queryKey: ['/api/assignments'],
  });

  // Usar ubicaciones de la API o del WebSocket
  useEffect(() => {
    if (locations.length > 0) {
      setActiveLocations(locations);
    }
  }, [locations]);

  // Función para obtener información del chofer por driverId
  const getDriverInfo = (driverId: string) => {
    return drivers.find(driver => driver.id === driverId);
  };

  // Función para obtener la ruta asignada al chofer
  const getDriverRoute = (driverId: string) => {
    const assignment = assignments.find(a => a.driverId === driverId);
    if (assignment) {
      return routes.find(r => r.id === assignment.scheduleId);
    }
    return null;
  };

  // Centrar mapa en una ubicación específica
  const centerMapOnLocation = (lat: number, lng: number) => {
    setMapCenter({ lat, lng });
    setMapZoom(15);
  };

  // Obtener el tiempo actual en Guatemala
  const getCurrentTimeInGuatemala = () => {
    return new Intl.DateTimeFormat('es-GT', {
      timeZone: 'America/Guatemala',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(new Date());
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Bus className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Transporte Público</h1>
                <p className="text-sm text-gray-600">Información en Tiempo Real para Pasajeros</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              <span>{getCurrentTimeInGuatemala()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab("mapa")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "mapa"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <MapPin className="w-4 h-4 inline mr-2" />
              Mapa en Vivo
            </button>
            <button
              onClick={() => setActiveTab("rutas")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "rutas"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Route className="w-4 h-4 inline mr-2" />
              Rutas y Horarios
            </button>
            <button
              onClick={() => setActiveTab("incidentes")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "incidentes"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              Alertas e Incidentes
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Tab: Mapa en Vivo */}
        {activeTab === "mapa" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Ubicación en Tiempo Real</h2>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {activeLocations.filter(loc => loc.isTransmitting).length} buses activos
              </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Mapa */}
              <div className="lg:col-span-3">
                <Card>
                  <CardContent className="p-0">
                    <div className="h-96 w-full rounded-lg overflow-hidden">
                      <GoogleMap
                        center={mapCenter}
                        zoom={mapZoom}
                        locations={activeLocations}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Lista de Buses Activos */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Buses en Servicio</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {activeLocations
                    .filter(location => location.isTransmitting)
                    .map((location) => {
                      const driver = getDriverInfo(location.driverId);
                      const route = getDriverRoute(location.driverId);
                      
                      return (
                        <Card key={location.id} className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <Circle className="w-3 h-3 text-green-500 fill-current" />
                                <span className="font-medium text-sm truncate">
                                  {driver?.fullName || 'Chofer'}
                                </span>
                              </div>
                              {route && (
                                <p className="text-xs text-gray-600 mt-1">
                                  {route.routeName}
                                </p>
                              )}
                              <p className="text-xs text-gray-500 mt-1">
                                Actualizado: {location.timestamp ? new Date(location.timestamp).toLocaleTimeString('es-GT', {
                                  timeZone: 'America/Guatemala',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) : 'Sin fecha'}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => centerMapOnLocation(
                                parseFloat(location.latitude),
                                parseFloat(location.longitude)
                              )}
                              className="ml-2"
                            >
                              <MapPin className="w-3 h-3" />
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                </div>
                
                {activeLocations.filter(loc => loc.isTransmitting).length === 0 && (
                  <Card className="p-4 text-center">
                    <Bus className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      No hay buses transmitiendo ubicación en este momento
                    </p>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Rutas y Horarios */}
        {activeTab === "rutas" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Rutas y Horarios</h2>
              <Badge variant="secondary">
                {routes.length} rutas disponibles
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {routesLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 rounded"></div>
                        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                routes.map((route) => (
                  <Card key={route.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center justify-between">
                        <span className="truncate">{route.routeName}</span>
                        <Badge variant={route.isActive ? "default" : "secondary"}>
                          {route.isActive ? "Activa" : "Inactiva"}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Número de Ruta:</span>
                          <span className="font-medium">{route.routeNumber}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Horario:</span>
                          <span className="font-medium">
                            {route.startTime} - {route.endTime}
                          </span>
                        </div>
                        
                        {/* Mostrar si hay buses activos en esta ruta */}
                        {(() => {
                          const routeAssignments = assignments.filter(a => a.scheduleId === route.id);
                          const activeBuses = routeAssignments.filter(assignment => 
                            activeLocations.some(loc => 
                              loc.driverId === assignment.driverId && loc.isTransmitting
                            )
                          );
                          
                          return activeBuses.length > 0 && (
                            <div className="flex items-center space-x-2 p-2 bg-green-50 rounded-lg">
                              <Circle className="w-3 h-3 text-green-500 fill-current" />
                              <span className="text-sm text-green-700">
                                {activeBuses.length} bus{activeBuses.length > 1 ? 'es' : ''} en servicio
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {routes.length === 0 && !routesLoading && (
              <Card className="p-8 text-center">
                <Route className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No hay rutas disponibles</h3>
                <p className="text-gray-500">
                  Actualmente no hay rutas configuradas en el sistema.
                </p>
              </Card>
            )}
          </div>
        )}

        {/* Tab: Alertas e Incidentes */}
        {activeTab === "incidentes" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Alertas e Incidentes</h2>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Sistema Operativo
              </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Estado General del Sistema */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Info className="w-5 h-5 text-blue-500" />
                    <span>Estado del Sistema</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Circle className="w-4 h-4 text-green-500 fill-current" />
                      <span className="font-medium text-green-900">Servicio GPS</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Operativo</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Circle className="w-4 h-4 text-green-500 fill-current" />
                      <span className="font-medium text-green-900">Comunicaciones</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Operativo</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Circle className="w-4 h-4 text-green-500 fill-current" />
                      <span className="font-medium text-green-900">Actualización de Datos</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">En Línea</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Información de Contacto */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    <span>Información de Contacto</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">¿Necesitas Ayuda?</h4>
                    <p className="text-sm text-blue-700 mb-3">
                      Si tienes alguna consulta sobre rutas, horarios o el servicio de transporte, 
                      puedes contactarnos:
                    </p>
                    <div className="space-y-2 text-sm">
                      <p className="text-blue-700">
                        <strong>Teléfono:</strong> (502) 2XXX-XXXX
                      </p>
                      <p className="text-blue-700">
                        <strong>Horario de Atención:</strong> 6:00 AM - 10:00 PM
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Reporte de Incidentes</h4>
                    <p className="text-sm text-gray-700">
                      Para reportar problemas con el servicio de transporte, 
                      comunícate directamente con nuestro centro de control.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Avisos Generales */}
            <Card>
              <CardHeader>
                <CardTitle>Avisos Importantes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                    <div className="flex items-start">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
                      <div>
                        <h4 className="font-medium text-yellow-800">Información del Sistema</h4>
                        <p className="text-sm text-yellow-700 mt-1">
                          La información mostrada en este sistema se actualiza en tiempo real. 
                          Los horarios pueden variar debido a condiciones del tráfico y otros factores.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
                    <div className="flex items-start">
                      <Info className="w-5 h-5 text-blue-600 mt-0.5 mr-3" />
                      <div>
                        <h4 className="font-medium text-blue-800">Uso Responsable</h4>
                        <p className="text-sm text-blue-700 mt-1">
                          Esta herramienta es para consulta informativa. 
                          Siempre mantén las medidas de seguridad al abordar el transporte público.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}