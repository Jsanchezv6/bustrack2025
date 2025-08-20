import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Report, User } from "@shared/schema";
import { AlertTriangle, Clock, MessageCircle } from "lucide-react";

interface ReportWithDriver extends Report {
  driverName?: string;
}

export function ReportsTable() {
  // Obtener todos los reportes
  const { data: reports = [], isLoading: reportsLoading } = useQuery<Report[]>({
    queryKey: ['/api/reports'],
  });

  // Obtener todos los usuarios para mapear nombres de choferes
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Combinar reportes con información del chofer
  const reportsWithDrivers: ReportWithDriver[] = reports.map(report => {
    const driver = users.find(user => user.id === report.driverId);
    return {
      ...report,
      driverName: driver?.fullName || 'Chofer desconocido'
    };
  });

  // Ordenar por fecha más reciente primero
  const sortedReports = reportsWithDrivers.sort((a, b) => 
    new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
  );

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case 'atraso':
        return <Clock className="w-4 h-4" />;
      case 'incidente':
        return <AlertTriangle className="w-4 h-4" />;
      case 'otro':
        return <MessageCircle className="w-4 h-4" />;
      default:
        return <MessageCircle className="w-4 h-4" />;
    }
  };

  const getReportTypeBadge = (type: string) => {
    switch (type) {
      case 'atraso':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Atraso</Badge>;
      case 'incidente':
        return <Badge variant="destructive">Incidente</Badge>;
      case 'otro':
        return <Badge variant="outline">Otro</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const formatDateTime = (timestamp: Date | string | null) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('es-GT', {
      timeZone: 'America/Guatemala',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (reportsLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
        <p className="text-gray-600">Cargando reportes...</p>
      </div>
    );
  }

  if (sortedReports.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-600 mb-2">No hay reportes</h3>
        <p className="text-gray-500">Los reportes de incidentes aparecerán aquí cuando los choferes los envíen.</p>
      </div>
    );
  }

  return (
    <>
      {/* Vista móvil - Cards */}
      <div className="block sm:hidden space-y-3">
        {sortedReports.map((report) => (
          <Card key={report.id} className="p-4" data-testid={`card-report-${report.id}`}>
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  {getReportTypeIcon(report.type)}
                  {getReportTypeBadge(report.type)}
                </div>
                <span className="text-xs text-gray-500">
                  {formatDateTime(report.timestamp)}
                </span>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">{report.driverName}</h4>
                <p className="text-sm text-gray-600 mt-1 line-clamp-3">
                  {report.description}
                </p>
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Fecha/Hora
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Chofer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Tipo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Descripción
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedReports.map((report) => (
              <tr key={report.id} className="hover:bg-gray-50" data-testid={`row-report-${report.id}`}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {formatDateTime(report.timestamp)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {report.driverName}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    {getReportTypeIcon(report.type)}
                    {getReportTypeBadge(report.type)}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 max-w-md">
                    <p className="line-clamp-2" title={report.description}>
                      {report.description}
                    </p>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}