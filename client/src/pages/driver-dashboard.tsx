import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { useGeolocation } from "@/hooks/use-geolocation";
import { apiRequest } from "@/lib/queryClient";
import { authManager } from "@/lib/auth";
import { Assignment, Schedule } from "@shared/schema";
import { 
  Compass, 
  LogOut,
  MapPin,
  Play,
  Square,
  Clock,
  Route,
  Circle,
  CheckCircle,
  StopCircle,
  List,
  Calendar
} from "lucide-react";
import { ReportModal } from "@/components/report-modal";

export default function DriverDashboard() {
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [showShiftQueue, setShowShiftQueue] = useState(false);
  const { toast } = useToast();
  const currentUser = authManager.getCurrentUser();

  // Debug: Verificar usuario actual
  console.log('Usuario actual en dashboard chofer:', currentUser);

  // WebSocket connection
  const { sendMessage, isConnected } = useWebSocket({
    onConnect: () => {
      console.log('WebSocket connected');
    },
    onDisconnect: () => {
      console.log('WebSocket disconnected');
    }
  });

  // Función para detener transmisión
  const stopTransmissionSafely = async () => {
    if (currentUser && currentUser.role === 'driver') {
      try {
        await apiRequest("POST", "/api/locations/stop-transmission", {
          driverId: currentUser.id
        });
        console.log('Transmisión detenida correctamente');
      } catch (error) {
        console.error('Error deteniendo transmisión:', error);
      }
    }
  };

  // Detectar cuando se cierra la página
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isTransmitting && currentUser && currentUser.role === 'driver') {
        // Usar sendBeacon para garantizar que la petición se envíe antes de cerrar
        const data = JSON.stringify({ driverId: currentUser.id });
        const blob = new Blob([data], { type: 'application/json' });
        navigator.sendBeacon('/api/locations/stop-transmission', blob);
        console.log('Transmisión detenida por cierre de página');
      }
    };

    // También detectar cuando se pierde el foco de la ventana por mucho tiempo
    const handleVisibilityChange = () => {
      if (document.hidden && isTransmitting && currentUser) {
        // Esperar 30 segundos antes de detener transmisión automáticamente
        setTimeout(() => {
          if (document.hidden && isTransmitting) {
            stopTransmissionSafely();
          }
        }, 30000);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isTransmitting, currentUser]);

  // Geolocation hook
  const { 
    coordinates, 
    error: locationError, 
    startTracking, 
    stopTracking,
    isSupported 
  } = useGeolocation({
    onLocationUpdate: (coords) => {
      if (isTransmitting && currentUser) {
        const timestamp = new Date().toISOString();
        console.log(`Nueva ubicación obtenida [${timestamp}]:`, coords);
        
        // Send location update via API
        apiRequest("POST", "/api/locations", {
          driverId: currentUser.id,
          latitude: coords.latitude.toString(),
          longitude: coords.longitude.toString(),
          isTransmitting: true,
        }).then(response => {
          console.log(`Ubicación enviada exitosamente [${timestamp}]:`, response);
        }).catch(error => {
          console.error(`Error enviando ubicación [${timestamp}]:`, error);
        });

        // Also send via WebSocket for real-time updates
        sendMessage({
          type: 'locationUpdate',
          location: {
            driverId: currentUser.id,
            latitude: coords.latitude.toString(),
            longitude: coords.longitude.toString(),
            isTransmitting: true,
            timestamp: timestamp
          }
        });
      }
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error de ubicación",
        description: error,
      });
      setIsTransmitting(false);
    }
  });

  // Query para obtener turnos actual y siguiente
  const { data: shifts, isLoading: shiftsLoading, error: shiftsError } = useQuery<{
    current: Assignment | null,
    next: Assignment | null
  }>({
    queryKey: ['/api/assignments/driver', currentUser?.id, 'shifts'],
    queryFn: async () => {
      if (!currentUser?.id) return { current: null, next: null };
      const response = await fetch(`/api/assignments/driver/${currentUser.id}/shifts`);
      if (!response.ok) {
        throw new Error(`Error loading shifts: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!currentUser?.id,
    refetchInterval: 60000, // Refrescar cada minuto para actualizar turnos
  });

  // Query para schedule del turno actual
  const { data: currentSchedule, isLoading: currentScheduleLoading } = useQuery<Schedule>({
    queryKey: ['/api/schedules', shifts?.current?.scheduleId],
    queryFn: async () => {
      if (!shifts?.current?.scheduleId) return null;
      const response = await fetch(`/api/schedules/${shifts.current.scheduleId}`);
      if (!response.ok) {
        throw new Error(`Error loading current schedule: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!shifts?.current?.scheduleId,
  });

  // Query para schedule del turno siguiente
  const { data: nextSchedule, isLoading: nextScheduleLoading } = useQuery<Schedule>({
    queryKey: ['/api/schedules', shifts?.next?.scheduleId],
    queryFn: async () => {
      if (!shifts?.next?.scheduleId) return null;
      const response = await fetch(`/api/schedules/${shifts.next.scheduleId}`);
      if (!response.ok) {
        throw new Error(`Error loading next schedule: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!shifts?.next?.scheduleId,
  });

  // Query para obtener todos los turnos del día (cola de turnos)
  const { data: allTodayShifts = [], isLoading: allShiftsLoading } = useQuery<Assignment[]>({
    queryKey: ['/api/assignments/driver', currentUser?.id, 'all'],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      const response = await fetch(`/api/assignments/driver/${currentUser.id}`);
      if (!response.ok) {
        throw new Error(`Error loading all shifts: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!currentUser?.id && showShiftQueue,
    refetchInterval: 30000, // Actualizar cada 30 segundos
  });

  // Debug data
  console.log('Shifts data:', shifts);
  console.log('Current schedule:', currentSchedule);
  console.log('Next schedule:', nextSchedule);

  const handleToggleTransmission = () => {
    if (!isSupported) {
      toast({
        variant: "destructive",
        title: "Geolocalización no soportada",
        description: "Su navegador no soporta geolocalización.",
      });
      return;
    }

    if (!isTransmitting) {
      console.log('Iniciando transmisión de ubicación...');
      
      // Primero obtener ubicación inmediata y luego iniciar tracking continuo
      forceLocationUpdate();
      startTracking();
      setIsTransmitting(true);
      
      // Notify server about transmission status
      if (currentUser) {
        sendMessage({
          type: 'transmissionStatus',
          driverId: currentUser.id,
          isTransmitting: true
        });
      }

      toast({
        title: "Transmisión iniciada",
        description: "Su ubicación se está compartiendo en tiempo real.",
      });
    } else {
      console.log('Deteniendo transmisión de ubicación...');
      stopTracking();
      setIsTransmitting(false);
      
      // Detener transmisión usando el endpoint específico
      if (currentUser) {
        stopTransmissionSafely();
        
        sendMessage({
          type: 'transmissionStatus',
          driverId: currentUser.id,
          isTransmitting: false
        });
      }

      toast({
        title: "Transmisión detenida",
        description: "Ha dejado de compartir su ubicación.",
      });
    }
  };

  const handleLogout = async () => {
    if (isTransmitting) {
      stopTracking();
      setIsTransmitting(false);
    }
    await authManager.logout();
  };

  // Función para forzar una obtención de ubicación nueva
  const forceLocationUpdate = () => {
    if (!currentUser) return;
    
    console.log('Forzando obtención de nueva ubicación...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = position.coords;
        const timestamp = new Date().toISOString();
        console.log(`Ubicación forzada obtenida [${timestamp}]:`, coords);
        
        // Enviar inmediatamente via API
        apiRequest("POST", "/api/locations", {
          driverId: currentUser.id,
          latitude: coords.latitude.toString(),
          longitude: coords.longitude.toString(),
          isTransmitting: true,
        }).then(response => {
          console.log('Ubicación forzada enviada:', response);
          toast({
            title: "Ubicación actualizada",
            description: `Nueva posición: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`,
          });
        }).catch(error => {
          console.error('Error enviando ubicación forzada:', error);
        });
      },
      (error) => {
        console.error('Error obteniendo ubicación forzada:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo obtener la ubicación actual",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0 // Siempre fresco
      }
    );
  };

  // Calculate remaining time in current shift
  const getRemainingTime = () => {
    if (!shifts?.current) return null;
    
    const now = new Date();
    const [endHour, endMinute] = shifts.current.shiftEnd.split(':').map(Number);
    const endTime = new Date();
    endTime.setHours(endHour, endMinute, 0, 0);
    
    if (endTime < now) {
      return "Turno finalizado";
    }
    
    const diff = endTime.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const routeStops = [
    { name: "Terminal Central", type: "start" },
    { name: "Plaza Mayor", type: "stop" },
    { name: "Hospital Regional", type: "stop" },
    { name: "Universidad Nacional", type: "end" },
  ];

  // Ya no necesitamos este loading global, se maneja individualmente en cada sección

  return (
    <div className="min-h-screen bg-neutral">
      {/* Navigation */}
      <nav className="bg-secondary text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              <Compass className="text-xl sm:text-2xl flex-shrink-0" />
              <h1 className="text-lg sm:text-xl font-semibold truncate">Panel Chofer</h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <span className="text-xs sm:text-sm hidden sm:block">{currentUser?.fullName}</span>
              <span className="text-xs sm:hidden">
                {currentUser?.fullName?.split(' ')[0]}
              </span>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={handleLogout}
                className="bg-green-700 hover:bg-green-800 px-2 sm:px-3"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden lg:inline ml-2">Salir</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-8">
        {/* Location Control Card */}
        <Card className="mb-6 sm:mb-8">
          <CardContent className="p-4 sm:p-6 text-center">
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-4">Control de Ubicación</h2>
            
            <div className="mb-6">
              <div className="flex items-center justify-center mb-4">
                <MapPin 
                  className={`text-4xl ${
                    isTransmitting ? 'text-green-500' : 'text-gray-400'
                  }`} 
                />
              </div>
              <p className={`mb-4 ${
                isTransmitting ? 'text-green-600 font-medium' : 'text-gray-600'
              }`}>
                Estado: {isTransmitting ? 'Transmitiendo ubicación' : 'Desconectado'}
              </p>
              {isTransmitting && (
                <p className="text-sm text-gray-500">
                  Ubicación compartida cada 30 segundos
                </p>
              )}
              {locationError && (
                <p className="text-sm text-red-500 mb-2">{locationError}</p>
              )}
              {coordinates && isTransmitting && (
                <p className="text-xs text-gray-500">
                  Lat: {coordinates.latitude.toFixed(6)}, Lng: {coordinates.longitude.toFixed(6)}
                </p>
              )}
            </div>

            <Button
              onClick={handleToggleTransmission}
              className={`px-8 py-4 text-lg font-semibold ${
                isTransmitting 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-accent hover:bg-accent-dark'
              }`}
              disabled={!isSupported}
            >
              {isTransmitting ? (
                <>
                  <Square className="w-5 h-5 mr-2" />
                  Detener Transmisión
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Iniciar Transmisión
                </>
              )}
            </Button>

            {!isSupported && (
              <p className="text-sm text-red-500 mt-2">
                Su navegador no soporta geolocalización
              </p>
            )}

            <div className="mt-4 flex items-center justify-center space-x-4 text-sm">
              <div className="flex items-center">
                <Circle className={`w-3 h-3 mr-1 ${isConnected ? 'text-green-500 fill-current' : 'text-red-500'}`} />
                WebSocket: {isConnected ? 'Conectado' : 'Desconectado'}
              </div>
            </div>

            {/* Botón de reportar incidente */}
            {currentUser && (
              <div className="mt-6 max-w-xs mx-auto">
                <ReportModal driverId={currentUser.id} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Turno Actual */}
        {shifts?.current && currentSchedule && (
          <Card className="mb-6 sm:mb-8">
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">Mi Turno Actual</h3>
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                <div className="flex items-start sm:items-center mb-4 space-x-3 sm:space-x-4">
                  <div className="bg-green-600 text-white rounded-full w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-lg sm:text-xl font-bold flex-shrink-0">
                    {currentSchedule.routeNumber}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base sm:text-lg font-semibold truncate">Ruta {currentSchedule.routeName}</h4>
                    <p className="text-sm sm:text-base text-gray-600">Turno: {shifts.current.shiftStart} - {shifts.current.shiftEnd}</p>
                    <p className="text-xs sm:text-sm text-gray-500">Fecha: {shifts.current.assignedDate}</p>
                    {getRemainingTime() && (
                      <p className="text-xs sm:text-sm text-blue-600 font-medium">Tiempo restante: {getRemainingTime()}</p>
                    )}
                  </div>
                </div>

                <div className="text-sm">
                  <div>
                    <span className="text-gray-600">Estado:</span>
                    <span className={`font-medium ml-2 ${shifts.current.isActive ? 'text-green-600' : 'text-red-600'}`}>
                      {shifts.current.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Turno Siguiente */}
        {shifts?.next && (
          <Card className="mb-6 sm:mb-8">
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">Mi Turno Siguiente</h3>
              <div className="bg-blue-50 rounded-lg p-3 sm:p-4">
                {nextScheduleLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Cargando información de la ruta...</p>
                  </div>
                ) : nextSchedule ? (
                  <>
                    <div className="flex items-start sm:items-center mb-4 space-x-3 sm:space-x-4">
                      <div className="bg-blue-600 text-white rounded-full w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-lg sm:text-xl font-bold flex-shrink-0">
                        {nextSchedule.routeNumber}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-base sm:text-lg font-semibold truncate">Ruta {nextSchedule.routeName}</h4>
                        <p className="text-sm sm:text-base text-gray-600">Turno: {shifts.next.shiftStart} - {shifts.next.shiftEnd}</p>
                        <p className="text-xs sm:text-sm text-gray-500">Fecha: {shifts.next.assignedDate}</p>
                        <p className="text-xs sm:text-sm text-blue-600 font-medium">Inicia a las {shifts.next.shiftStart}</p>
                      </div>
                    </div>

                    <div className="text-sm">
                      <div>
                        <span className="text-gray-600">Estado:</span>
                        <span className={`font-medium ml-2 ${shifts.next.isActive ? 'text-green-600' : 'text-red-600'}`}>
                          {shifts.next.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-600">Error cargando información de la ruta</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading state */}
        {shiftsLoading && (
          <Card className="mb-8">
            <CardContent className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary mx-auto mb-4"></div>
              <p>Cargando información de turnos...</p>
            </CardContent>
          </Card>
        )}

        {/* Botón Cola de Turnos */}
        {(shifts?.current || shifts?.next) && (
          <Card className="mb-6 sm:mb-8">
            <CardContent className="p-4 sm:p-6 text-center">
              <Button
                onClick={() => setShowShiftQueue(!showShiftQueue)}
                className="bg-purple-600 hover:bg-purple-700 text-white w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3"
                size="sm"
              >
                <List className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                <span className="text-sm sm:text-base">
                  {showShiftQueue ? 'Ocultar Cola de Turnos' : 'Ver Cola de Turnos'}
                </span>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Modal/Sección Cola de Turnos */}
        {showShiftQueue && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="flex items-center mb-4">
                <Calendar className="w-6 h-6 text-purple-600 mr-2" />
                <h3 className="text-xl font-semibold text-gray-800">Cola de Turnos - Hoy</h3>
              </div>
              
              {allShiftsLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                  <p>Cargando turnos...</p>
                </div>
              ) : allTodayShifts.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No hay turnos programados para hoy</p>
              ) : (
                <div className="space-y-3">
                  {allTodayShifts.map((shift, index) => {
                    const now = new Date();
                    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                    const isCurrentShift = currentTime >= shift.shiftStart && currentTime <= shift.shiftEnd;
                    const isCompleted = currentTime > shift.shiftEnd;
                    const isPending = currentTime < shift.shiftStart;
                    
                    return (
                      <div key={shift.id} className={`border rounded-lg p-4 ${
                        isCurrentShift ? 'bg-green-50 border-green-200' : 
                        isCompleted ? 'bg-gray-50 border-gray-200' : 
                        'bg-blue-50 border-blue-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className={`rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3 ${
                              isCurrentShift ? 'bg-green-600 text-white' : 
                              isCompleted ? 'bg-gray-400 text-white' : 
                              'bg-blue-600 text-white'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium">
                                Turno {shift.shiftStart} - {shift.shiftEnd}
                              </p>
                              <p className="text-sm text-gray-600">
                                Fecha: {shift.assignedDate}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {isCurrentShift && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                En Curso
                              </span>
                            )}
                            {isCompleted && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                                <StopCircle className="w-3 h-3 mr-1" />
                                Completado
                              </span>
                            )}
                            {isPending && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                <Clock className="w-3 h-3 mr-1" />
                                Pendiente
                              </span>
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
        )}

        {/* No shifts message */}
        {!shifts?.current && !shifts?.next && !shiftsLoading && (
          <Card className="mb-8">
            <CardContent className="p-6 text-center">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Sin Turnos Asignados</h3>
              <p className="text-gray-600">
                No tiene turnos asignados para hoy. Contacte con el administrador.
              </p>
              {shiftsError && (
                <p className="text-sm text-red-500 mt-2">
                  Error: {String(shiftsError)}
                </p>
              )}
            </CardContent>
          </Card>
        )}


      </div>
    </div>
  );
}
