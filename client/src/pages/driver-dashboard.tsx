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
  Calendar,
  Menu,
  X,
  Home,
  Car,
  AlertTriangle
} from "lucide-react";
import { ReportModal } from "@/components/report-modal";

export default function DriverDashboard() {
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [showShiftQueue, setShowShiftQueue] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [transmissionInterval, setTransmissionInterval] = useState<NodeJS.Timeout | null>(null);
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

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
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
      console.log('🚀 Iniciando transmisión de ubicación...');
      
      setIsTransmitting(true);
      
      // Enviar ubicación inmediatamente
      forceLocationUpdate();
      
      // Configurar intervalo para enviar ubicación cada 15 segundos
      const interval = setInterval(() => {
        console.log('⏰ Ejecutando envío programado de ubicación...');
        forceLocationUpdate();
      }, 15000); // 15 segundos
      
      setTransmissionInterval(interval);
      
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
        description: "Su ubicación se está compartiendo cada 15 segundos.",
      });
    } else {
      console.log('🛑 Deteniendo transmisión de ubicación...');
      setIsTransmitting(false);
      
      // Limpiar intervalo
      if (transmissionInterval) {
        clearInterval(transmissionInterval);
        setTransmissionInterval(null);
        console.log('🗑️ Intervalo de transmisión eliminado');
      }
      
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
      setIsTransmitting(false);
      if (transmissionInterval) {
        clearInterval(transmissionInterval);
        setTransmissionInterval(null);
      }
    }
    await authManager.logout();
  };

  // Limpiar intervalo al desmontar el componente
  useEffect(() => {
    return () => {
      if (transmissionInterval) {
        clearInterval(transmissionInterval);
      }
    };
  }, [transmissionInterval]);

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

  // Configuración de elementos del sidebar del chofer
  const sidebarItems = [
    {
      id: "home",
      label: "Inicio",
      icon: Home,
      description: "Control de ubicación"
    },
    {
      id: "shifts",
      label: "Mis Turnos",
      icon: Calendar,
      description: "Turnos asignados"
    },
    {
      id: "reports",
      label: "Reportar",
      icon: AlertTriangle,
      description: "Reportar incidentes"
    }
  ];

  return (
    <div className="min-h-screen bg-neutral flex">
      {/* Sidebar */}
      <div className={`
        bg-secondary text-white transition-all duration-300 ease-in-out
        ${isMobileMenuOpen ? 'w-64' : 'w-0 lg:w-64'} 
        fixed lg:static inset-y-0 left-0 z-30 overflow-hidden
      `}>
        <div className="flex flex-col h-full">
          {/* Header del sidebar */}
          <div className="flex items-center justify-between p-4 border-b border-secondary-foreground/20">
            <div className="flex items-center space-x-3">
              <Compass className="w-8 h-8" />
              <span className="font-bold text-lg">Panel Chofer</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden text-white hover:bg-secondary-foreground/20"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Navegación */}
          <nav className="flex-1 px-4 py-6">
            <ul className="space-y-2">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`
                        w-full flex items-center space-x-3 px-3 py-3 rounded-lg text-left transition-colors
                        ${isActive 
                          ? 'bg-secondary-foreground/20 text-white' 
                          : 'text-secondary-foreground hover:bg-secondary-foreground/10 hover:text-white'
                        }
                      `}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium">{item.label}</div>
                        <div className="text-xs text-secondary-foreground/70 truncate">
                          {item.description}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer del sidebar */}
          <div className="p-4 border-t border-secondary-foreground/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-secondary-foreground/20 rounded-full flex items-center justify-center">
                  <Car className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{currentUser?.fullName}</div>
                  <div className="text-xs text-secondary-foreground/70">Chofer</div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-secondary-foreground hover:bg-secondary-foreground/20 hover:text-white"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay para móviles */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header principal */}
        <header className="bg-white shadow-sm border-b">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="lg:hidden"
                >
                  <Menu className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">
                    {sidebarItems.find(item => item.id === activeTab)?.label || "Dashboard"}
                  </h1>
                  <p className="text-sm text-gray-500">
                    {sidebarItems.find(item => item.id === activeTab)?.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Área de contenido */}
        <main className="flex-1 overflow-auto">
          <div className="px-4 sm:px-6 lg:px-8 py-8">

            {/* Sección Inicio - Control de Ubicación */}
            {activeTab === "home" && (
              <div className="space-y-6">
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
              </div>
            )}

            {/* Sección Mis Turnos */}
            {activeTab === "shifts" && (
              <div className="space-y-6">
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
            )}

            {/* Sección Reportes */}
            {activeTab === "reports" && (
              <div className="space-y-6">
                <Card>
                  <CardContent className="p-6 text-center">
                    <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Reportar Incidente</h3>
                    <p className="text-gray-600 mb-6">
                      Use este formulario para reportar cualquier incidente o problema durante su turno.
                    </p>
                    {currentUser && (
                      <div className="max-w-xs mx-auto">
                        <ReportModal driverId={currentUser.id} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
