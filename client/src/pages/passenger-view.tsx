import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Clock, Bus, AlertTriangle, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GoogleMap } from '@/components/google-map';
import { Location, Assignment, Route } from '@shared/schema';

interface PassengerViewProps {
  onBackToLogin: () => void;
}

export default function PassengerView({ onBackToLogin }: PassengerViewProps) {
  const [mapCenter, setMapCenter] = useState({ lat: 14.634915, lng: -90.506882 }); // Guatemala City
  const [mapZoom, setMapZoom] = useState(12);

  // Consultar ubicaciones en tiempo real
  const { data: locations = [], isLoading: locationsLoading } = useQuery<Location[]>({
    queryKey: ['/api/locations'],
    refetchInterval: 5000, // Actualizar cada 5 segundos
  });

  // Consultar asignaciones/turnos
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<Assignment[]>({
    queryKey: ['/api/assignments'],
    refetchInterval: 30000, // Actualizar cada 30 segundos
  });

  // Consultar rutas para obtener nombres
  const { data: routes = [] } = useQuery<Route[]>({
    queryKey: ['/api/schedules'],
  });

  // Obtener información de choferes transmitiendo
  const transmittingDrivers = locations.filter(loc => loc.isTransmitting);

  // Función para centrar el mapa en un chofer específico
  const centerOnDriver = (driverId: string) => {
    const driverLocation = locations.find(loc => loc.driverId === driverId && loc.isTransmitting);
    if (driverLocation) {
      setMapCenter({
        lat: parseFloat(driverLocation.latitude),
        lng: parseFloat(driverLocation.longitude)
      });
      setMapZoom(16);
    }
  };

  // Obtener información de la ruta por ID
  const getRouteInfo = (scheduleId: string) => {
    return routes.find((route) => route.id === scheduleId);
  };

  // Formatear hora
  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('es-GT', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Guatemala'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Bus className="h-8 w-8" />
              <div>
                <h1 className="text-xl font-bold">Transporte Público</h1>
                <p className="text-blue-100 text-sm">Monitoreo en Tiempo Real</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onBackToLogin}
              className="bg-white text-blue-600 hover:bg-blue-50"
              data-testid="button-back-to-login"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Mapa */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5" />
                  <span>Ubicación de Buses en Tiempo Real</span>
                  <Badge variant="secondary" data-testid="badge-active-buses">
                    {transmittingDrivers.length} en servicio
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {locationsLoading ? (
                  <div className="w-full h-96 flex items-center justify-center bg-gray-100 rounded-lg">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p className="text-gray-600">Cargando mapa...</p>
                    </div>
                  </div>
                ) : (
                  <GoogleMap
                    locations={locations}
                    center={mapCenter}
                    zoom={mapZoom}
                    className="w-full h-96 rounded-lg"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Panel de información */}
          <div className="space-y-6">
            {/* Buses Activos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Bus className="h-5 w-5" />
                  <span>Buses Activos</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {transmittingDrivers.length === 0 ? (
                  <div className="text-center py-4">
                    <Bus className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">No hay buses transmitiendo</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transmittingDrivers.map((location, index) => (
                      <div key={location.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                        <div>
                          <p className="font-medium text-green-800" data-testid={`text-driver-${index}`}>
                            Bus #{index + 1}
                          </p>
                          <p className="text-sm text-green-600">
                            Transmitiendo
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => centerOnDriver(location.driverId)}
                          className="bg-green-600 hover:bg-green-700"
                          data-testid={`button-locate-driver-${index}`}
                        >
                          <Navigation className="h-4 w-4 mr-1" />
                          Localizar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Horarios/Turnos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Horarios de Turnos</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {assignmentsLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-600">Cargando horarios...</p>
                  </div>
                ) : assignments.length === 0 ? (
                  <div className="text-center py-4">
                    <Clock className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">No hay turnos programados</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {assignments
                      .sort((a, b) => a.shiftStart.localeCompare(b.shiftStart))
                      .map((assignment, index) => {
                        const route = getRouteInfo(assignment.scheduleId);
                        const driverLocation = locations.find(loc => loc.driverId === assignment.driverId);
                        const isTransmitting = driverLocation?.isTransmitting || false;
                        
                        return (
                          <div key={assignment.id} className="p-3 border rounded-lg hover:bg-gray-50">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="font-medium" data-testid={`text-route-${index}`}>
                                  {route?.routeName || 'Ruta sin nombre'}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {formatTime(assignment.shiftStart)} - {formatTime(assignment.shiftEnd)}
                                </p>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Badge 
                                  variant={isTransmitting ? "default" : "secondary"}
                                  className={isTransmitting ? "bg-green-600" : ""}
                                  data-testid={`badge-status-${index}`}
                                >
                                  {isTransmitting ? "En servicio" : "Inactivo"}
                                </Badge>
                                {isTransmitting && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => centerOnDriver(assignment.driverId)}
                                    data-testid={`button-track-driver-${index}`}
                                  >
                                    <Navigation className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Información General */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Estado del Servicio</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Buses operando:</span>
                    <Badge variant="default" data-testid="badge-total-operating">
                      {transmittingDrivers.length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Turnos programados:</span>
                    <Badge variant="secondary" data-testid="badge-total-shifts">
                      {assignments.length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Estado general:</span>
                    <Badge 
                      variant={transmittingDrivers.length > 0 ? "default" : "secondary"}
                      className={transmittingDrivers.length > 0 ? "bg-green-600" : ""}
                      data-testid="badge-service-status"
                    >
                      {transmittingDrivers.length > 0 ? "Operativo" : "Sin servicio"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}