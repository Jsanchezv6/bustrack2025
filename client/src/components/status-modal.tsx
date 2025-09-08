import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { authManager } from "@/lib/auth";
import { RefreshCw } from "lucide-react";

// Esquema para actualizar estado
const statusFormSchema = z.object({
  driverStatus: z.enum(["disponible", "en_ruta_cargar", "en_ruta_descargar", "cargando", "descargando", "no_disponible"], {
    errorMap: () => ({ message: "Debe seleccionar un estado válido" }),
  }),
});

type StatusFormData = z.infer<typeof statusFormSchema>;

interface StatusModalProps {
  driverId: string;
  currentStatus?: string;
}

export function StatusModal({ driverId, currentStatus = "disponible" }: StatusModalProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<StatusFormData>({
    resolver: zodResolver(statusFormSchema),
    defaultValues: {
      driverStatus: currentStatus as StatusFormData["driverStatus"],
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (data: StatusFormData) =>
      apiRequest('PUT', `/api/users/${driverId}/status`, data),
    onSuccess: (response) => {
      toast({
        title: "Estado actualizado",
        description: "Su estado ha sido actualizado exitosamente.",
      });
      setOpen(false);
      
      // Actualizar el usuario en AuthManager con el nuevo estado
      const currentUser = authManager.getCurrentUser();
      if (currentUser) {
        const updatedUser = { ...currentUser, driverStatus: form.getValues().driverStatus };
        authManager.setCurrentUser(updatedUser);
      }
      
      // Invalidar las consultas para refrescar los datos
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/drivers'] });
      queryClient.refetchQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: any) => {
      console.error("Error actualizando estado:", error);
      toast({
        variant: "destructive",
        title: "Error al actualizar estado",
        description: error.message || "No se pudo actualizar el estado. Intente nuevamente.",
      });
    },
  });

  const onSubmit = (data: StatusFormData) => {
    updateStatusMutation.mutate(data);
  };

  // Obtener etiqueta legible para cada estado
  const getStatusLabel = (status: string) => {
    const statusLabels: Record<string, string> = {
      "disponible": "Disponible",
      "en_ruta_cargar": "En ruta a cargar",
      "en_ruta_descargar": "En ruta a descargar", 
      "cargando": "Cargando",
      "descargando": "Descargando",
      "no_disponible": "No disponible"
    };
    return statusLabels[status] || status;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="w-full flex items-center justify-center space-x-2"
          data-testid="button-update-status"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Actualizar Estado</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <RefreshCw className="w-5 h-5" />
            <span>Actualizar Estado</span>
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="driverStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado del Chofer</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-driver-status">
                        <SelectValue placeholder="Seleccione su estado actual" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="disponible" data-testid="status-disponible">
                        🟢 Disponible
                      </SelectItem>
                      <SelectItem value="en_ruta_cargar" data-testid="status-en-ruta-cargar">
                        🟡 En ruta a cargar
                      </SelectItem>
                      <SelectItem value="en_ruta_descargar" data-testid="status-en-ruta-descargar">
                        🟠 En ruta a descargar
                      </SelectItem>
                      <SelectItem value="cargando" data-testid="status-cargando">
                        🔵 Cargando
                      </SelectItem>
                      <SelectItem value="descargando" data-testid="status-descargando">
                        🟣 Descargando
                      </SelectItem>
                      <SelectItem value="no_disponible" data-testid="status-no-disponible">
                        🔴 No disponible
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
              <p className="font-medium mb-1">Estado actual:</p>
              <p>{getStatusLabel(currentStatus)}</p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="mt-2 sm:mt-0"
                data-testid="button-cancel-status"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateStatusMutation.isPending}
                data-testid="button-save-status"
              >
                {updateStatusMutation.isPending ? "Actualizando..." : "Actualizar Estado"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}