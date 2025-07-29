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
  StopCircle
} from "lucide-react";

export default function DriverDashboard() {
  const [isTransmitting, setIsTransmitting] = useState(false);
  const { toast } = useToast();
  const currentUser = authManager.getCurrentUser();

  // WebSocket connection
  const { sendMessage, isConnected } = useWebSocket({
    onConnect: () => {
      console.log('WebSocket connected');
    },
    onDisconnect: () => {
      console.log('WebSocket disconnected');
    }
  });

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
        // Send location update via API
        apiRequest("POST", "/api/locations", {
          driverId: currentUser.id,
          latitude: coords.latitude.toString(),
          longitude: coords.longitude.toString(),
          isTransmitting: true,
        }).catch(error => {
          console.error('Error sending location:', error);
        });

        // Also send via WebSocket for real-time updates
        sendMessage({
          type: 'locationUpdate',
          location: {
            driverId: currentUser.id,
            latitude: coords.latitude.toString(),
            longitude: coords.longitude.toString(),
            isTransmitting: true,
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

  // Query for driver's current assignment
  const { data: assignment, isLoading: assignmentLoading } = useQuery<Assignment>({
    queryKey: ['/api/assignments/driver', currentUser?.id],
    enabled: !!currentUser?.id,
  });

  // Query for schedule details
  const { data: schedule, isLoading: scheduleLoading } = useQuery<Schedule>({
    queryKey: ['/api/schedules', assignment?.scheduleId],
    enabled: !!assignment?.scheduleId,
  });

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
      // Primero obtener ubicación actual para confirmar permisos
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };

          console.log('🔍 Coordenadas GPS obtenidas del dispositivo:', coords);
          
          startTracking();
          setIsTransmitting(true);
          
          // Enviar ubicación inicial inmediatamente
          if (currentUser) {
            apiRequest("POST", "/api/locations", {
              driverId: currentUser.id,
              latitude: coords.latitude.toString(),
              longitude: coords.longitude.toString(),
              isTransmitting: true,
            }).then(() => {
              console.log('✅ Ubicación enviada al servidor:', coords);
            }).catch(error => {
              console.error('❌ Error enviando ubicación:', error);
            });

            // Notificar estado de transmisión
            sendMessage({
              type: 'transmissionStatus',
              driverId: currentUser.id,
              isTransmitting: true
            });
          }

          toast({
            title: "Transmisión iniciada",
            description: `GPS activo en: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`,
          });
        },
        (error) => {
          let errorMessage = 'Error al obtener ubicación GPS';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Permisos de ubicación denegados. Active la ubicación en su navegador.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Ubicación GPS no disponible. Verifique su conexión.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Tiempo de espera agotado. Intente nuevamente.';
              break;
          }
          
          toast({
            variant: "destructive",
            title: "Error GPS",
            description: errorMessage,
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000
        }
      );
    } else {
      stopTracking();
      setIsTransmitting(false);
      
      // Notify server about transmission status
      if (currentUser) {
        sendMessage({
          type: 'transmissionStatus',
          driverId: currentUser.id,
          isTransmitting: false
        });
      }

      toast({
        title: "Transmisión detenida",
        description: "Ha dejado de compartir su ubicación GPS.",
      });
    }
  };

  const handleLogout = () => {
    if (isTransmitting) {
      stopTracking();
      setIsTransmitting(false);
    }
    authManager.logout();
  };

  // Calculate remaining time in shift
  const getRemainingTime = () => {
    if (!assignment) return null;
    
    const now = new Date();
    const [endHour, endMinute] = assignment.shiftEnd.split(':').map(Number);
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

  if (assignmentLoading || scheduleLoading) {
    return (
      <div className="min-h-screen bg-neutral flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary mx-auto mb-4"></div>
          <p>Cargando información del turno...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral">
      {/* Navigation */}
      <nav className="bg-secondary text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Compass className="text-2xl" />
              <h1 className="text-xl font-semibold">Panel Chofer</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm">{currentUser?.fullName}</span>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={handleLogout}
                className="bg-green-700 hover:bg-green-800"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Location Control Card */}
        <Card className="mb-8">
          <CardContent className="p-6 text-center">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Control de Ubicación</h2>
            
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
          </CardContent>
        </Card>

        {/* Current Assignment */}
        {assignment && schedule ? (
          <Card className="mb-8">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Mi Turno Actual</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center mb-4">
                  <div className="bg-primary text-white rounded-full w-12 h-12 flex items-center justify-center text-xl font-bold mr-4">
                    {schedule.routeNumber}
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold">Ruta {schedule.routeName}</h4>
                    <p className="text-gray-600">Turno: {assignment.shiftStart} - {assignment.shiftEnd}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Frecuencia:</span>
                    <span className="font-medium ml-2">{schedule.frequency} minutos</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Tiempo restante:</span>
                    <span className="font-medium ml-2 text-green-600">{getRemainingTime()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-8">
            <CardContent className="p-6 text-center">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Sin Turno Asignado</h3>
              <p className="text-gray-600">
                No tiene turnos asignados para hoy. Contacte con el administrador.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Route Information */}
        {schedule && (
          <Card>
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Información de Ruta</h3>

              <div className="space-y-4">
                {routeStops.map((stop, index) => (
                  <div key={index} className="flex items-center space-x-4">
                    <div className={`p-2 rounded-full ${
                      stop.type === 'start' ? 'bg-green-100' :
                      stop.type === 'end' ? 'bg-red-100' : 'bg-blue-100'
                    }`}>
                      {stop.type === 'start' && <CheckCircle className="text-green-600 w-5 h-5" />}
                      {stop.type === 'end' && <StopCircle className="text-red-600 w-5 h-5" />}
                      {stop.type === 'stop' && <Circle className="text-blue-600 w-3 h-3 fill-current" />}
                    </div>
                    <div>
                      <p className="font-medium">{stop.name}</p>
                      <p className="text-sm text-gray-600">
                        {stop.type === 'start' && 'Punto de inicio'}
                        {stop.type === 'end' && 'Destino final'}
                        {stop.type === 'stop' && 'Parada intermedia'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
