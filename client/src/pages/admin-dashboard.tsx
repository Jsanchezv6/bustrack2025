import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { authManager } from "@/lib/auth";
import { Route as RouteType, Assignment, User, Location, Bus } from "@shared/schema";
import { ScheduleModal } from "@/components/schedule-modal";
import { AssignmentModal } from "@/components/assignment-modal";
import { GoogleMap } from "@/components/google-map";
import { UserModal } from "@/components/user-modal";
import { BusModal } from "@/components/bus-modal";
import { ReportsTable } from "@/components/reports-table";
import { 
  Bus as BusIcon, 
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
  const [selectedRoute, setSelectedRoute] = useState<RouteType | null>(null);
  const [activeLocations, setActiveLocations] = useState<Location[]>([]);
  const [mapCenter, setMapCenter] = useState({ lat: -12.0464, lng: -77.0428 });
  const [mapZoom, setMapZoom] = useState(12);
  const mapRef = useRef<any>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isBusModalOpen, setIsBusModalOpen] = useState(false);
  const [selectedBus, setSelectedBus] = useState<Bus | null>(null);
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
      
      if (message.type === 'transmissionStatusUpdate' || 
          message.type === 'transmissionStatus' || 
          message.type === 'transmissionStopped') {
        queryClient.invalidateQueries({ queryKey: ['/api/locations'] });
        queryClient.refetchQueries({ queryKey: ['/api/locations'] });
      }
    }
  });

  const handleLogout = () => {
    authManager.logout();
    window.location.href = '/login';
  };

  // Fetch data
  const { data: schedules = [], isLoading: schedulesLoading } = useQuery<RouteType[]>({
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

  const { data: buses = [], isLoading: busesLoading } = useQuery<Bus[]>({
    queryKey: ['/api/buses'],
  });

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['/api/locations'],
    refetchInterval: 5000,
  });

  // Mutations
  const deleteScheduleMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
      toast({ title: "Horario eliminado correctamente" });
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/assignments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
      toast({ title: "Asignación eliminada correctamente" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/drivers'] });
      toast({ title: "Usuario eliminado correctamente" });
    },
  });

  const deleteBusMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/buses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/buses'] });
      toast({ title: "Bus eliminado correctamente" });
    },
  });

  // Helper functions
  const handleEditSchedule = (schedule: RouteType) => {
    setSelectedRoute(schedule);
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

  const handleEditBus = (bus: Bus) => {
    setSelectedBus(bus);
    setIsBusModalOpen(true);
  };

  const handleDeleteBus = (id: string) => {
    if (confirm("¿Está seguro de que desea eliminar este bus?")) {
      deleteBusMutation.mutate(id);
    }
  };

  const locateDriver = async (driverId: string) => {
    try {
      const allLocations = await queryClient.fetchQuery({
        queryKey: ['/api/locations'],
      });
      
      const driverLocation = (allLocations as Location[]).find((l: Location) => 
        l.driverId === driverId && l.isTransmitting
      );
      
      if (driverLocation) {
        const lat = parseFloat(driverLocation.latitude);
        const lng = parseFloat(driverLocation.longitude);
        
        setMapCenter({ lat, lng });
        setMapZoom(16);
        
        toast({
          title: "Ubicación encontrada",
          description: `Chofer localizado en: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Sin ubicación",
          description: "El chofer no ha enviado ninguna ubicación",
        });
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

  // Data processing
  const assignmentsWithDrivers = assignments.map(assignment => {
    const driver = drivers.find(d => d.id === assignment.driverId);
    const schedule = schedules.find(s => s.id === assignment.scheduleId);
    const bus = buses.find(b => b.id === assignment.busId);
    return { ...assignment, driver, schedule, bus };
  });

  const uniqueDriversWithAssignments = drivers.map(driver => {
    const driverAssignments = assignmentsWithDrivers.filter(a => a.driverId === driver.id);
    return {
      driver,
      assignments: driverAssignments,
      firstAssignment: driverAssignments[0] || null
    };
  }).filter(item => item.assignments.length > 0);

  const availableDrivers = drivers;

  // Stats
  const stats = {
    totalBuses: buses.filter(b => b.isActive).length,
    totalDrivers: drivers.length,
    totalRoutes: schedules.length,
    activeTransmissions: locations.filter((l: Location) => l.isTransmitting).length,
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
      label: "Rutas",
      icon: Calendar,
      description: "Gestión de rutas"
    },
    {
      id: "buses",
      label: "Buses",
      icon: Car,
      description: "Gestión de buses"
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
              <BusIcon className="w-8 h-8" />
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
                          <BusIcon className="text-primary text-lg sm:text-xl" />
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

                {/* Resumen rápido */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Resumen del Sistema</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Total de rutas configuradas</p>
                        <p className="font-medium">{schedules.length} rutas</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Asignaciones activas</p>
                        <p className="font-medium">{assignments.length} asignaciones</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Choferes registrados</p>
                        <p className="font-medium">{drivers.length} choferes</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Usuarios totales</p>
                        <p className="font-medium">{users.length} usuarios</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Sección Rutas */}
            {activeTab === "schedules" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Gestión de Rutas</h2>
                  <Button
                    onClick={() => setIsScheduleModalOpen(true)}
                    className="bg-primary hover:bg-primary-dark"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Ruta
                  </Button>
                </div>

                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ruta</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Horario</th>
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
                            No hay rutas configuradas
                          </td>
                        </tr>
                      ) : (
                        schedules.map((schedule) => (
                          <tr key={schedule.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                                {schedule.routeNumber}
                              </div>
                            </td>
                            <td className="px-6 py-4 font-medium">{schedule.routeName}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {schedule.startTime} - {schedule.endTime}
                            </td>
                            <td className="px-6 py-4">
                              <Badge variant={schedule.isActive ? "default" : "secondary"}>
                                {schedule.isActive ? "Activo" : "Inactivo"}
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditSchedule(schedule)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteSchedule(schedule.id)}
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

                {/* Vista móvil para rutas */}
                <div className="lg:hidden space-y-4">
                  {schedulesLoading ? (
                    <Card>
                      <CardContent className="p-4 text-center">Cargando...</CardContent>
                    </Card>
                  ) : schedules.length === 0 ? (
                    <Card>
                      <CardContent className="p-4 text-center text-gray-500">
                        No hay rutas configuradas
                      </CardContent>
                    </Card>
                  ) : (
                    schedules.map((schedule) => (
                      <Card key={schedule.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div className="bg-primary text-white rounded-full w-10 h-10 flex items-center justify-center text-sm font-bold">
                                {schedule.routeNumber}
                              </div>
                              <div>
                                <h3 className="font-medium">{schedule.routeName}</h3>
                                <p className="text-sm text-gray-500">{schedule.startTime} - {schedule.endTime}</p>
                              </div>
                            </div>
                            <Badge variant={schedule.isActive ? "default" : "secondary"}>
                              {schedule.isActive ? "Activo" : "Inactivo"}
                            </Badge>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditSchedule(schedule)}
                              className="flex-1"
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteSchedule(schedule.id)}
                              className="flex-1"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Eliminar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Sección Buses */}
            {activeTab === "buses" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Gestión de Buses</h2>
                  <Button
                    onClick={() => {
                      setSelectedBus(null);
                      setIsBusModalOpen(true);
                    }}
                    className="bg-primary hover:bg-primary-dark"
                    data-testid="button-new-bus"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Bus
                  </Button>
                </div>

                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Placa</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unidad</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modelo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Año</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacidad</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {busesLoading ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-4 text-center">Cargando...</td>
                        </tr>
                      ) : buses.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                            No hay buses registrados
                          </td>
                        </tr>
                      ) : (
                        buses.map((bus) => (
                          <tr key={bus.id} className="hover:bg-gray-50" data-testid={`row-bus-${bus.id}`}>
                            <td className="px-6 py-4 font-medium">{bus.plateNumber}</td>
                            <td className="px-6 py-4">{bus.busNumber}</td>
                            <td className="px-6 py-4">{bus.model}</td>
                            <td className="px-6 py-4">{bus.year}</td>
                            <td className="px-6 py-4">{bus.capacity} pax</td>
                            <td className="px-6 py-4">
                              <Badge 
                                variant={
                                  bus.status === "disponible" ? "default" :
                                  bus.status === "en_servicio" ? "secondary" :
                                  bus.status === "mantenimiento" ? "outline" :
                                  "destructive"
                                }
                              >
                                {bus.status === "disponible" ? "Disponible" :
                                 bus.status === "en_servicio" ? "En Servicio" :
                                 bus.status === "mantenimiento" ? "Mantenimiento" :
                                 "Fuera de Servicio"}
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditBus(bus)}
                                  data-testid={`button-edit-bus-${bus.id}`}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteBus(bus.id)}
                                  data-testid={`button-delete-bus-${bus.id}`}
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

                {/* Vista móvil para buses */}
                <div className="lg:hidden space-y-4">
                  {busesLoading ? (
                    <Card>
                      <CardContent className="p-4 text-center">Cargando...</CardContent>
                    </Card>
                  ) : buses.length === 0 ? (
                    <Card>
                      <CardContent className="p-4 text-center text-gray-500">
                        No hay buses registrados
                      </CardContent>
                    </Card>
                  ) : (
                    buses.map((bus) => (
                      <Card key={bus.id} data-testid={`card-bus-${bus.id}`}>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold text-lg">{bus.plateNumber}</p>
                              <p className="text-sm text-gray-600">Unidad #{bus.busNumber}</p>
                              <p className="text-sm text-gray-600">{bus.model} ({bus.year})</p>
                              <p className="text-sm text-gray-600">Capacidad: {bus.capacity} pasajeros</p>
                            </div>
                            <Badge 
                              variant={
                                bus.status === "disponible" ? "default" :
                                bus.status === "en_servicio" ? "secondary" :
                                bus.status === "mantenimiento" ? "outline" :
                                "destructive"
                              }
                            >
                              {bus.status === "disponible" ? "Disponible" :
                               bus.status === "en_servicio" ? "En Servicio" :
                               bus.status === "mantenimiento" ? "Mantenimiento" :
                               "Fuera de Servicio"}
                            </Badge>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditBus(bus)}
                              className="flex-1"
                              data-testid={`button-edit-bus-mobile-${bus.id}`}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteBus(bus.id)}
                              className="flex-1"
                              data-testid={`button-delete-bus-mobile-${bus.id}`}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Eliminar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Sección Asignaciones */}
            {activeTab === "assignments" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Asignación de Choferes</h2>
                  <Button
                    onClick={() => setIsAssignmentModalOpen(true)}
                    className="bg-primary hover:bg-primary-dark"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Asignación
                  </Button>
                </div>

                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chofer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ruta</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bus</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Turno</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {assignmentsLoading ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-4 text-center">Cargando...</td>
                        </tr>
                      ) : assignmentsWithDrivers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                            No hay asignaciones configuradas
                          </td>
                        </tr>
                      ) : (
                        assignmentsWithDrivers.map((assignment) => (
                          <tr key={assignment.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <div className="bg-secondary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold mr-3">
                                  <Car className="w-4 h-4" />
                                </div>
                                <span className="font-medium">{assignment.driver?.fullName || 'Sin asignar'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {assignment.schedule ? (
                                <div className="flex items-center">
                                  <div className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-2">
                                    {assignment.schedule.routeNumber}
                                  </div>
                                  <span className="text-sm">{assignment.schedule.routeName}</span>
                                </div>
                              ) : (
                                <span className="text-gray-500">Sin ruta</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {assignment.bus ? (
                                <div className="flex items-center">
                                  <div className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-2">
                                    {assignment.bus.busNumber}
                                  </div>
                                  <span className="text-sm">{assignment.bus.plateNumber}</span>
                                </div>
                              ) : (
                                <span className="text-gray-500">Sin bus</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">{assignment.assignedDate}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {assignment.shiftStart} - {assignment.shiftEnd}
                            </td>
                            <td className="px-6 py-4">
                              <Badge variant={assignment.isActive ? "default" : "secondary"}>
                                {assignment.isActive ? "Activo" : "Inactivo"}
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteAssignment(assignment.id)}
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

                {/* Vista móvil para asignaciones */}
                <div className="lg:hidden space-y-4">
                  {assignmentsLoading ? (
                    <Card>
                      <CardContent className="p-4 text-center">Cargando...</CardContent>
                    </Card>
                  ) : assignmentsWithDrivers.length === 0 ? (
                    <Card>
                      <CardContent className="p-4 text-center text-gray-500">
                        No hay asignaciones configuradas
                      </CardContent>
                    </Card>
                  ) : (
                    assignmentsWithDrivers.map((assignment) => (
                      <Card key={assignment.id}>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="bg-secondary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">
                                  <Car className="w-4 h-4" />
                                </div>
                                <span className="font-medium text-sm">{assignment.driver?.fullName || 'Sin asignar'}</span>
                              </div>
                              <Badge variant={assignment.isActive ? "default" : "secondary"}>
                                {assignment.isActive ? "Activo" : "Inactivo"}
                              </Badge>
                            </div>
                            
                            {assignment.schedule && (
                              <div className="flex items-center space-x-2">
                                <div className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                                  {assignment.schedule.routeNumber}
                                </div>
                                <span className="text-sm">{assignment.schedule.routeName}</span>
                              </div>
                            )}
                            
                            {assignment.bus && (
                              <div className="flex items-center space-x-2">
                                <div className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                                  {assignment.bus.busNumber}
                                </div>
                                <span className="text-sm">{assignment.bus.plateNumber} - {assignment.bus.model}</span>
                              </div>
                            )}
                            
                            <div className="text-xs text-gray-500 space-y-1">
                              <p>Fecha: {assignment.assignedDate}</p>
                              <p>Turno: {assignment.shiftStart} - {assignment.shiftEnd}</p>
                            </div>
                            
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteAssignment(assignment.id)}
                              className="w-full"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Eliminar Asignación
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Sección Monitoreo */}
            {activeTab === "monitoring" && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Monitoreo en Tiempo Real</h2>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Estado de choferes */}
                  <div className="lg:col-span-1">
                    <Card>
                      <CardContent className="p-4 sm:p-6">
                        <h3 className="text-lg font-semibold mb-4">Estado de Choferes</h3>
                        <div className="space-y-3">
                          {uniqueDriversWithAssignments.length === 0 ? (
                            <p className="text-sm text-gray-500">No hay choferes asignados</p>
                          ) : (
                            uniqueDriversWithAssignments.map(({ driver, firstAssignment }) => {
                              const isTransmitting = locations.some((l: Location) => l.driverId === driver.id && l.isTransmitting);
                              
                              return (
                                <div key={driver.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                  <div className="flex items-center space-x-3">
                                    <div className="bg-secondary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">
                                      <Car className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <p className="font-medium text-sm">{driver.fullName}</p>
                                      {firstAssignment?.schedule && (
                                        <p className="text-xs text-gray-500">
                                          Ruta {firstAssignment.schedule.routeNumber}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Circle className={`w-3 h-3 ${isTransmitting ? 'text-green-500 fill-current' : 'text-red-500'}`} />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => locateDriver(driver.id)}
                                      disabled={!isTransmitting}
                                    >
                                      <Navigation className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Mapa */}
                  <div className="lg:col-span-2">
                    <Card>
                      <CardContent className="p-4 sm:p-6">
                        <h3 className="text-lg font-semibold mb-4">Mapa de Ubicaciones</h3>
                        <div className="h-96 bg-gray-100 rounded-lg overflow-hidden">
                          <GoogleMap
                            center={mapCenter}
                            zoom={mapZoom}
                            locations={locations.filter((l: Location) => l.isTransmitting)}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            )}

            {/* Sección Usuarios */}
            {activeTab === "users" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Gestión de Usuarios</h2>
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

                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre Completo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Licencia</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {usersLoading ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-4 text-center">Cargando...</td>
                        </tr>
                      ) : users.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
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

                {/* Vista móvil para usuarios */}
                <div className="lg:hidden space-y-4">
                  {usersLoading ? (
                    <Card>
                      <CardContent className="p-4 text-center">Cargando...</CardContent>
                    </Card>
                  ) : users.length === 0 ? (
                    <Card>
                      <CardContent className="p-4 text-center text-gray-500">
                        No hay usuarios registrados
                      </CardContent>
                    </Card>
                  ) : (
                    users.map((user) => (
                      <Card key={user.id}>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm ${
                                  user.role === 'admin' ? 'bg-blue-500' : 'bg-green-500'
                                }`}>
                                  {user.role === 'admin' ? <Shield className="w-4 h-4" /> : <Car className="w-4 h-4" />}
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{user.username}</p>
                                  <p className="text-xs text-gray-500">{user.fullName}</p>
                                </div>
                              </div>
                              <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                                {user.role === 'admin' ? 'Admin' : 'Chofer'}
                              </Badge>
                            </div>
                            
                            {user.licenseNumber && (
                              <div className="text-xs text-gray-500">
                                Licencia: {user.licenseNumber}
                              </div>
                            )}
                            
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setIsUserModalOpen(true);
                                }}
                                className="flex-1"
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  if (confirm("¿Está seguro de que desea eliminar este usuario?")) {
                                    deleteUserMutation.mutate(user.id);
                                  }
                                }}
                                className="flex-1"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Eliminar
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Sección Reportes */}
            {activeTab === "reports" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Reportes de Incidentes</h2>
                </div>
                <ReportsTable />
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Modals */}
      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => {
          setIsScheduleModalOpen(false);
          setSelectedRoute(null);
        }}
        schedule={selectedRoute}
      />

      <AssignmentModal
        isOpen={isAssignmentModalOpen}
        onClose={() => setIsAssignmentModalOpen(false)}
        drivers={availableDrivers}
        schedules={schedules}
        buses={buses}
      />

      <UserModal
        isOpen={isUserModalOpen}
        onClose={() => {
          setIsUserModalOpen(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
      />

      <BusModal
        isOpen={isBusModalOpen}
        onClose={() => {
          setIsBusModalOpen(false);
          setSelectedBus(null);
        }}
        bus={selectedBus}
      />
    </div>
  );
}