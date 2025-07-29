import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { InsertAssignment, insertAssignmentSchema, User, Schedule } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { X } from "lucide-react";

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  drivers: User[];
  schedules: Schedule[];
}

export function AssignmentModal({ isOpen, onClose, drivers, schedules }: AssignmentModalProps) {
  const { toast } = useToast();

  const form = useForm<InsertAssignment>({
    resolver: zodResolver(insertAssignmentSchema),
    defaultValues: {
      driverId: "",
      scheduleId: "",
      assignedDate: new Date().toISOString().split('T')[0],
      shiftStart: "06:00",
      shiftEnd: "14:00",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertAssignment) => apiRequest("POST", "/api/assignments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/drivers'] });
      toast({ 
        title: "Asignación creada exitosamente",
        description: "El chofer ha sido asignado al turno.",
      });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error al crear asignación",
        description: error.message || "No se pudo crear la asignación",
      });
    },
  });

  const onSubmit = (data: InsertAssignment) => {
    createMutation.mutate(data);
  };

  const selectedSchedule = schedules.find(s => s.id === form.watch("scheduleId"));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle className="text-2xl font-semibold text-gray-800">
              Nueva Asignación
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="driverId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chofer</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger disabled={createMutation.isPending}>
                        <SelectValue placeholder="Seleccione un chofer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.fullName} - {driver.licenseNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="scheduleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ruta</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger disabled={createMutation.isPending}>
                        <SelectValue placeholder="Seleccione una ruta" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {schedules.filter(s => s.isActive).map((schedule) => (
                        <SelectItem key={schedule.id} value={schedule.id}>
                          Ruta {schedule.routeNumber} - {schedule.routeName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assignedDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Asignación</FormLabel>
                  <FormControl>
                    <Input 
                      type="date" 
                      {...field}
                      disabled={createMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="shiftStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inicio del Turno</FormLabel>
                    <FormControl>
                      <Input 
                        type="time" 
                        {...field}
                        disabled={createMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shiftEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fin del Turno</FormLabel>
                    <FormControl>
                      <Input 
                        type="time" 
                        {...field}
                        disabled={createMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {selectedSchedule && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">Información de la Ruta</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Horario de operación:</span>
                    <span className="ml-2 font-medium">
                      {selectedSchedule.startTime} - {selectedSchedule.endTime}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Frecuencia:</span>
                    <span className="ml-2 font-medium">{selectedSchedule.frequency} minutos</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex space-x-4">
              <Button 
                type="button" 
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={createMutation.isPending}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="flex-1 bg-primary hover:bg-primary-dark"
                disabled={createMutation.isPending || drivers.length === 0 || schedules.length === 0}
              >
                {createMutation.isPending ? "Creando..." : "Crear Asignación"}
              </Button>
            </div>

            {(drivers.length === 0 || schedules.length === 0) && (
              <p className="text-sm text-red-500 text-center">
                {drivers.length === 0 && "No hay choferes disponibles. "}
                {schedules.length === 0 && "No hay rutas activas disponibles."}
              </p>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
