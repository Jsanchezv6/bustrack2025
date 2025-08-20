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
import { ReportsTable } from "@/components/reports-table";
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
  Car,
  AlertTriangle,
  Menu,
  X,
  BarChart3
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
  const [activeTab, setActiveTab] = useState("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
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

  // Configuración de elementos del sidebar
  const sidebarItems = [
    {
      id: "overview",
      label: "Resumen",
      icon: BarChart3,
      description: "Estadísticas generales"
    },
    {
      id: "schedules",
      label: "Horarios",
      icon: Calendar,
      description: "Gestión de horarios"
    },
    {
      id: "assignments",
      label: "Asignaciones",
      icon: UserCog,
      description: "Asignar choferes"
    },
    {
      id: "monitoring",
      label: "Monitoreo",
      icon: MapPin,
      description: "Ubicaciones en tiempo real"
    },
    {
      id: "users",
      label: "Usuarios",
      icon: Users,
      description: "Gestión de usuarios"
    },
    {
      id: "reports",
      label: "Reportes",
      icon: AlertTriangle,
      description: "Incidentes reportados"
    }
  ];

  return (
    <div className="min-h-screen bg-neutral flex">
      {/* Sidebar */}
      <div className={`
        bg-primary text-white transition-all duration-300 ease-in-out
        ${isMobileMenuOpen ? 'w-64' : 'w-0 lg:w-64'} 
        fixed lg:static inset-y-0 left-0 z-30 overflow-hidden
      `}>
        <div className="flex flex-col h-full">
          {/* Header del sidebar */}
          <div className="flex items-center justify-between p-4 border-b border-primary-foreground/20">
            <div className="flex items-center space-x-3">
              <Bus className="w-8 h-8" />
              <span className="font-bold text-lg">Admin Panel</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden text-white hover:bg-primary-foreground/20"
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
                          ? 'bg-primary-foreground/20 text-white' 
                          : 'text-primary-foreground hover:bg-primary-foreground/10 hover:text-white'
                        }
                      `}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium">{item.label}</div>
                        <div className="text-xs text-primary-foreground/70 truncate">
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
          <div className="p-4 border-t border-primary-foreground/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary-foreground/20 rounded-full flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{currentUser?.fullName}</div>
                  <div className="text-xs text-primary-foreground/70">Administrador</div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-primary-foreground hover:bg-primary-foreground/20 hover:text-white"
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
            
            {/* Sección Resumen */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Dashboard Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <Card>
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center">
                <div className="bg-primary bg-opacity-10 p-2 sm:p-3 rounded-full flex-shrink-0">
                  <Bus className="text-primary text-lg sm:text-xl" />
                </div>
                <div className="ml-2 sm:ml-4 min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">{stats.totalBuses}</h3>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">Buses Activos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center">
                <div className="bg-secondary bg-opacity-10 p-2 sm:p-3 rounded-full flex-shrink-0">
                  <Users className="text-secondary text-lg sm:text-xl" />
                </div>
                <div className="ml-2 sm:ml-4 min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">{stats.totalDrivers}</h3>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">Choferes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center">
                <div className="bg-accent bg-opacity-10 p-2 sm:p-3 rounded-full flex-shrink-0">
                  <Route className="text-accent text-lg sm:text-xl" />
                </div>
                <div className="ml-2 sm:ml-4 min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">{stats.totalRoutes}</h3>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">Rutas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center">
                <div className="bg-green-500 bg-opacity-10 p-2 sm:p-3 rounded-full flex-shrink-0">
                  <MapPin className="text-green-500 text-lg sm:text-xl" />
                </div>
                <div className="ml-2 sm:ml-4 min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">{stats.activeTransmissions}</h3>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">Transmitiendo</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Card>
          <Tabs defaultValue="schedules" className="w-full">
            <div className="border-b border-gray-200 overflow-x-auto">
              <TabsList className="w-full min-w-max justify-start bg-transparent p-0 h-auto">
                <TabsTrigger 
                  value="schedules" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none whitespace-nowrap px-3 py-2 text-sm"
                >
                  <Calendar className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Horarios</span>
                  <span className="sm:hidden">Hor.</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="assignments"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none whitespace-nowrap px-3 py-2 text-sm"
                >
                  <UserCog className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Asignaciones</span>
                  <span className="sm:hidden">Asig.</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="users"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none whitespace-nowrap px-3 py-2 text-sm"
                >
                  <Users className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Usuarios</span>
                  <span className="sm:hidden">Users</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="monitoring"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none whitespace-nowrap px-3 py-2 text-sm"
                >
                  <Eye className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Monitoreo</span>
                  <span className="sm:hidden">Mon.</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="reports"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none whitespace-nowrap px-3 py-2 text-sm"
                >
                  <AlertTriangle className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Reportes</span>
                  <span className="sm:hidden">Rep.</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Schedules Tab */}
            <TabsContent value="schedules" className="p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Gestión de Horarios</h2>
                <Button 
                  onClick={() => {
                    setSelectedSchedule(null);
                    setIsScheduleModalOpen(true);
                  }}
                  className="bg-primary hover:bg-primary-dark w-full sm:w-auto"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Nuevo Horario</span>
                  <span className="sm:hidden">Nuevo</span>
                </Button>
              </div>

              {schedulesLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-gray-600">Cargando...</p>
                </div>
              ) : schedules.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No hay horarios</h3>
                  <p className="text-gray-500">Crea un horario para comenzar.</p>
                </div>
              ) : (
                <>
                  {/* Vista móvil - Cards */}
                  <div className="block sm:hidden space-y-3">
                    {schedules.map((schedule) => (
                      <Card key={schedule.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div className="bg-primary text-white rounded-full w-10 h-10 flex items-center justify-center text-sm font-bold flex-shrink-0">
                              {schedule.routeNumber}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-medium text-gray-900 truncate">{schedule.routeName}</h4>
                              <p className="text-sm text-gray-600">{schedule.startTime} - {schedule.endTime}</p>
                              <Badge 
                                variant={schedule.isActive ? "default" : "secondary"}
                                className="mt-1"
                              >
                                {schedule.isActive ? "Activo" : "Inactivo"}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex space-x-1 ml-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditSchedule(schedule)}
                              className="p-2"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSchedule(schedule.id)}
                              className="text-red-600 hover:text-red-800 p-2"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Vista desktop - Tabla */}
                  <div className="hidden sm:block overflow-x-auto">
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
                        {schedules.map((schedule) => (
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
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

            {/* Reports Tab */}
            <TabsContent value="reports" className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-800">Reportes de Choferes</h2>
              </div>

              <ReportsTable />
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
