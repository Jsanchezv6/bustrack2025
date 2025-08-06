import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { authManager } from "@/lib/auth";
import { Schedule, Assignment, User, Location } from "@shared/schema";
import { ScheduleModal } from "@/components/schedule-modal";
import { AssignmentModal } from "@/components/assignment-modal";
import { GoogleMap } from "@/components/google-map";
import { UserModal } from "@/components/user-modal";
import { 
  Bus, 
  Users, 
  Route, 
  MapPin, 
  LogOut,
  Calendar,
  UserCog,
  Eye,
  Plus,
  Edit,
  Trash2,
  Circle,
  Navigation,
  UserPlus,
  Shield,
  Car
} from "lucide-react";

export default function AdminDashboard() {
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [activeLocations, setActiveLocations] = useState<Location[]>([]);
  const [mapCenter, setMapCenter] = useState({ lat: -12.0464, lng: -77.0428 });
  const [mapZoom, setMapZoom] = useState(12);
  const mapRef = useRef<any>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  const { toast } = useToast();
  const currentUser = authManager.getCurrentUser();

  // WebSocket for real-time updates
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
      
      // Solo invalidar cache cuando hay cambios en WebSocket
      if (message.type === 'transmissionStatusUpdate' || 
          message.type === 'transmissionStatus' || 
          message.type === 'transmissionStopped') {
        // Forzar actualización inmediata de ubicaciones cuando cambia estado
        queryClient.invalidateQueries({ queryKey: ['/api/locations'] });
        queryClient.refetchQueries({ queryKey: ['/api/locations'] });
        
        // También limpiar el estado local para forzar re-renderización
        if (message.type === 'transmissionStopped') {
          console.log('WebSocket - Removiendo chofer del estado local:', message.data.driverId);
          setActiveLocations(prev => 
            prev.filter(loc => loc.driverId !== message.data.driverId)
          );
        }
        
        console.log('WebSocket - Actualizando estado de transmisión:', message.type, message.data);
      }
    }
  });

  // Queries
  const { data: schedules = [], isLoading: schedulesLoading } = useQuery<Schedule[]>({
    queryKey: ['/api/schedules'],
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<Assignment[]>({
    queryKey: ['/api/assignments'],
  });

  const { data: drivers = [], isLoading: driversLoading } = useQuery<User[]>({
    queryKey: ['/api/drivers'],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['/api/locations'],
    refetchInterval: 5000, // Actualizar cada 5 segundos para debug
    staleTime: 0, // Considerar datos obsoletos inmediatamente
    cacheTime: 0, // No mantener en cache
  });

  // Mutations
  const deleteScheduleMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
      toast({ title: "Horario eliminado exitosamente" });
    },
    onError: () => {
      toast({ 
        variant: "destructive", 
        title: "Error", 
        description: "No se pudo eliminar el horario" 
      });
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/assignments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
      toast({ title: "Asignación eliminada exitosamente" });
    },
    onError: () => {
      toast({ 
        variant: "destructive", 
        title: "Error", 
        description: "No se pudo eliminar la asignación" 
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/drivers'] });
      toast({ title: "Usuario eliminado exitosamente" });
    },
    onError: () => {
      toast({ 
        variant: "destructive", 
        title: "Error", 
        description: "No se pudo eliminar el usuario" 
      });
    },
  });

  const handleLogout = () => {
    authManager.logout();
  };

  // Función para localizar chofer en el mapa
  const locateDriver = async (driverId: string) => {
    try {
      // Buscar la ubicación más reciente del chofer directamente de la API
      const response = await fetch(`/api/locations`);
      const allLocations = await response.json();
      
      console.log('Todas las ubicaciones:', allLocations);
      console.log('Buscando chofer:', driverId);
      
      // Filtrar por el chofer específico y solo ubicaciones activas
      const driverLocation = allLocations.find((l: Location) => 
        l.driverId === driverId && l.isTransmitting
      );
      
      console.log('Ubicación encontrada:', driverLocation);
      
      if (driverLocation) {
        const lat = parseFloat(driverLocation.latitude);
        const lng = parseFloat(driverLocation.longitude);
        
        console.log(`Localizando chofer ${driverId} en:`, { lat, lng });
        
        setMapCenter({ lat, lng });
        setMapZoom(16); // Zoom más cercano para ver la ubicación específica
        
        toast({
          title: "Ubicación encontrada",
          description: `Chofer localizado en: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        });
      } else {
        // Verificar si existe ubicación pero no está transmitiendo
        const driverLocationAny = allLocations.find((l: Location) => l.driverId === driverId);
        if (driverLocationAny) {
          console.log(`Chofer ${driverId} tiene ubicación pero no está transmitiendo:`, driverLocationAny);
          toast({
            variant: "destructive",
            title: "Chofer no transmitiendo",
            description: `El chofer tiene ubicación guardada pero no está transmitiendo activamente`,
          });
        } else {
          console.log(`No se encontró ubicación para chofer: ${driverId}`);
          toast({
            variant: "destructive",
            title: "Sin ubicación",
            description: "El chofer no ha enviado ninguna ubicación",
          });
        }
      }
    } catch (error) {
      console.error('Error al obtener ubicación del chofer:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo obtener la ubicación del chofer",
      });
    }
  };

  const handleEditSchedule = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setIsScheduleModalOpen(true);
  };

  const handleDeleteSchedule = (id: string) => {
    if (confirm("¿Está seguro de que desea eliminar este horario?")) {
      deleteScheduleMutation.mutate(id);
    }
  };

  const handleDeleteAssignment = (id: string) => {
    if (confirm("¿Está seguro de que desea eliminar esta asignación?")) {
      deleteAssignmentMutation.mutate(id);
    }
  };

  // Get driver assignments with driver info
  const assignmentsWithDrivers = assignments.map(assignment => {
    const driver = drivers.find(d => d.id === assignment.driverId);
    const schedule = schedules.find(s => s.id === assignment.scheduleId);
    return { ...assignment, driver, schedule };
  });

  // Get unique drivers with their assignments (to avoid duplicates in monitoring)
  const uniqueDriversWithAssignments = drivers.map(driver => {
    const driverAssignments = assignmentsWithDrivers.filter(a => a.driverId === driver.id);
    return {
      driver,
      assignments: driverAssignments,
      // Use the first assignment for basic info display
      firstAssignment: driverAssignments[0] || null
    };
  }).filter(item => item.assignments.length > 0); // Only show drivers with assignments

  // Get all drivers as available (allowing multiple assignments per driver)
  const availableDrivers = drivers;

  // Stats
  const stats = {
    totalBuses: schedules.filter(s => s.isActive).length,
    totalDrivers: drivers.length,
    totalRoutes: schedules.length,
    activeTransmissions: locations.filter(l => l.isTransmitting).length,
  };

  return (
    <div className="min-h-screen bg-neutral">
      {/* Navigation */}
      <nav className="bg-primary text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Bus className="text-2xl" />
              <h1 className="text-xl font-semibold">Panel Administrador</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm">{currentUser?.fullName}</span>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={handleLogout}
                className="bg-blue-700 hover:bg-blue-800"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="bg-primary bg-opacity-10 p-3 rounded-full">
                  <Bus className="text-primary text-xl" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-800">{stats.totalBuses}</h3>
                  <p className="text-gray-600">Buses Activos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="bg-secondary bg-opacity-10 p-3 rounded-full">
                  <Users className="text-secondary text-xl" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-800">{stats.totalDrivers}</h3>
                  <p className="text-gray-600">Choferes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="bg-accent bg-opacity-10 p-3 rounded-full">
                  <Route className="text-accent text-xl" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-800">{stats.totalRoutes}</h3>
                  <p className="text-gray-600">Rutas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="bg-green-500 bg-opacity-10 p-3 rounded-full">
                  <MapPin className="text-green-500 text-xl" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-800">{stats.activeTransmissions}</h3>
                  <p className="text-gray-600">Transmitiendo</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Card>
          <Tabs defaultValue="schedules" className="w-full">
            <div className="border-b border-gray-200">
              <TabsList className="w-full justify-start bg-transparent p-0">
                <TabsTrigger 
                  value="schedules" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Horarios
                </TabsTrigger>
                <TabsTrigger 
                  value="assignments"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none"
                >
                  <UserCog className="w-4 h-4 mr-2" />
                  Asignaciones
                </TabsTrigger>
                <TabsTrigger 
                  value="users"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Usuarios
                </TabsTrigger>
                <TabsTrigger 
                  value="monitoring"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Monitoreo
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Schedules Tab */}
            <TabsContent value="schedules" className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-800">Gestión de Horarios</h2>
                <Button 
                  onClick={() => {
                    setSelectedSchedule(null);
                    setIsScheduleModalOpen(true);
                  }}
                  className="bg-primary hover:bg-primary-dark"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Horario
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ruta</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hora Inicio</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hora Fin</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {schedulesLoading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center">Cargando...</td>
                      </tr>
                    ) : schedules.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                          No hay horarios registrados
                        </td>
                      </tr>
                    ) : (
                      schedules.map((schedule) => (
                        <tr key={schedule.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">
                                {schedule.routeNumber}
                              </div>
                              <span className="font-medium">{schedule.routeName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-900">{schedule.startTime}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-900">{schedule.endTime}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={schedule.isActive ? "default" : "secondary"}>
                              {schedule.isActive ? "Activo" : "Inactivo"}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditSchedule(schedule)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSchedule(schedule.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* Assignments Tab */}
            <TabsContent value="assignments" className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-800">Asignación de Turnos</h2>
                <Button 
                  onClick={() => setIsAssignmentModalOpen(true)}
                  className="bg-primary hover:bg-primary-dark"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Asignación
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Available Drivers */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-4">Choferes Disponibles</h3>
                  <div className="space-y-3">
                    {driversLoading ? (
                      <p>Cargando...</p>
                    ) : availableDrivers.length === 0 ? (
                      <p className="text-gray-500">No hay choferes disponibles</p>
                    ) : (
                      availableDrivers.map((driver) => (
                        <Card key={driver.id} className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="bg-gray-300 rounded-full w-10 h-10 flex items-center justify-center mr-3">
                                <Users className="text-gray-600 w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-medium">{driver.fullName}</p>
                                <p className="text-sm text-gray-600">Licencia: {driver.licenseNumber}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="bg-green-100 text-green-800">
                              Disponible
                            </Badge>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </div>

                {/* Current Assignments */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-4">Asignaciones Actuales</h3>
                  <div className="space-y-3">
                    {assignmentsLoading ? (
                      <p>Cargando...</p>
                    ) : assignmentsWithDrivers.length === 0 ? (
                      <p className="text-gray-500">No hay asignaciones</p>
                    ) : (
                      assignmentsWithDrivers.map((assignment) => (
                        <Card key={assignment.id} className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <div className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-2">
                                {assignment.schedule?.routeNumber}
                              </div>
                              <span className="font-medium">{assignment.driver?.fullName}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAssignment(assignment.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <p className="text-sm text-gray-600">{assignment.schedule?.routeName}</p>
                          <p className="text-xs text-gray-500">{assignment.shiftStart} - {assignment.shiftEnd}</p>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Monitoring Tab */}
            <TabsContent value="monitoring" className="p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Monitoreo en Tiempo Real</h2>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Map Area */}
                <div className="lg:col-span-2">
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-800">Ubicaciones en Tiempo Real</h3>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="flex items-center text-green-600">
                          <Circle className="w-2 h-2 mr-1 fill-current" />
                          Activos: {locations.filter(l => l.isTransmitting).length}
                        </span>
                        <span className="text-gray-500">
                          Total ubicaciones: {[...locations, ...activeLocations].length}
                        </span>
                      </div>
                    </div>
                    <GoogleMap 
                      locations={[...locations, ...activeLocations]}
                      center={mapCenter}
                      zoom={mapZoom}
                      className="w-full h-96 rounded-lg"
                    />
                  </Card>
                </div>

                {/* Driver Status */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-800">Estado de Choferes</h3>
                  {uniqueDriversWithAssignments.map((driverItem) => {
                    const { driver, assignments, firstAssignment } = driverItem;
                    // Buscar ubicación más reciente del chofer en ambas fuentes
                    const locationFromAPI = locations.find(l => l.driverId === driver.id);
                    const locationFromWS = activeLocations.find(l => l.driverId === driver.id);
                    
                    // Usar la más reciente o la única disponible
                    const location = locationFromAPI || locationFromWS;
                    const isTransmitting = location?.isTransmitting || false;
                    
                    return (
                      <Card 
                        key={driver.id} 
                        className={`p-4 border-l-4 ${
                          isTransmitting ? 'border-green-500' : 'border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{driver.fullName}</span>
                          <span className={`flex items-center ${
                            isTransmitting ? 'text-green-600' : 'text-gray-500'
                          }`}>
                            <Circle className="w-2 h-2 mr-1 fill-current" />
                            {isTransmitting ? 'Transmitiendo' : 'Desconectado'}
                          </span>
                        </div>
                        
                        {/* Mostrar número de turnos asignados */}
                        <p className="text-sm text-gray-600 mb-1">
                          {assignments.length === 1 ? 
                            `1 turno asignado` : 
                            `${assignments.length} turnos asignados`
                          }
                        </p>
                        
                        {/* Mostrar información del primer turno o el más relevante */}
                        {firstAssignment && (
                          <p className="text-xs text-gray-500 mb-2">
                            Ruta {firstAssignment.schedule?.routeNumber} - {firstAssignment.schedule?.routeName}
                            {assignments.length > 1 && " (y otros)"}
                          </p>
                        )}
                        
                        <p className="text-xs text-gray-500 mb-3">
                          {location && location.timestamp ? 
                            `Última actualización: ${new Date(location.timestamp).toLocaleTimeString()}` :
                            'Sin datos de ubicación'
                          }
                        </p>
                        
                        {/* Botón Localizar */}
                        {location && isTransmitting && (
                          <Button
                            onClick={() => locateDriver(driver.id)}
                            size="sm"
                            variant="outline"
                            className="w-full text-xs"
                          >
                            <Navigation className="w-3 h-3 mr-1" />
                            Localizar en Mapa
                          </Button>
                        )}
                      </Card>
                    );
                  })}

                  {uniqueDriversWithAssignments.length === 0 && (
                    <p className="text-gray-500">No hay choferes asignados</p>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users" className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-800">Gestión de Usuarios</h2>
                <Button 
                  onClick={() => {
                    setSelectedUser(null);
                    setIsUserModalOpen(true);
                  }}
                  className="bg-primary hover:bg-primary-dark"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Nuevo Usuario
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre Completo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Licencia</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Creación</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {usersLoading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center">Cargando...</td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                          No hay usuarios registrados
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold mr-3 ${
                                user.role === 'admin' ? 'bg-blue-500' : 'bg-green-500'
                              }`}>
                                {user.role === 'admin' ? <Shield className="w-4 h-4" /> : <Car className="w-4 h-4" />}
                              </div>
                              <span className="font-medium">{user.username}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{user.fullName}</td>
                          <td className="px-6 py-4">
                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                              {user.role === 'admin' ? 'Administrador' : 'Chofer'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {user.licenseNumber || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setIsUserModalOpen(true);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  if (confirm("¿Está seguro de que desea eliminar este usuario?")) {
                                    deleteUserMutation.mutate(user.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      {/* Modals */}
      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => {
          setIsScheduleModalOpen(false);
          setSelectedSchedule(null);
        }}
        schedule={selectedSchedule}
      />

      <AssignmentModal
        isOpen={isAssignmentModalOpen}
        onClose={() => setIsAssignmentModalOpen(false)}
        drivers={availableDrivers}
        schedules={schedules}
      />

      <UserModal
        isOpen={isUserModalOpen}
        onClose={() => {
          setIsUserModalOpen(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
      />
    </div>
  );
}
