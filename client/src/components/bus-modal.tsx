import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertBusSchema, type InsertBus, type Bus } from "@shared/schema";

type BusFormData = InsertBus;

interface BusModalProps {
  isOpen: boolean;
  onClose: () => void;
  bus?: Bus | null;
}

export function BusModal({ isOpen, onClose, bus }: BusModalProps) {
  const { toast } = useToast();
  const isEditing = !!bus;

  const form = useForm<BusFormData>({
    resolver: zodResolver(insertBusSchema),
    defaultValues: {
      plateNumber: bus?.plateNumber || "",
      busNumber: bus?.busNumber || "",
      model: bus?.model || "",
      year: bus?.year || new Date().getFullYear(),
      capacity: bus?.capacity || 45,
      status: bus?.status || "disponible",
      isActive: bus?.isActive ?? true,
    },
  });

  const createBusMutation = useMutation({
    mutationFn: (busData: BusFormData) => 
      apiRequest("POST", "/api/buses", busData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/buses'] });
      toast({
        title: "Bus creado",
        description: "El bus ha sido creado exitosamente",
      });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo crear el bus",
      });
    },
  });

  const updateBusMutation = useMutation({
    mutationFn: (busData: Partial<Bus>) => 
      apiRequest("PUT", `/api/buses/${bus?.id}`, busData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/buses'] });
      toast({
        title: "Bus actualizado",
        description: "El bus ha sido actualizado exitosamente",
      });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo actualizar el bus",
      });
    },
  });

  const onSubmit = (data: BusFormData) => {
    if (isEditing) {
      updateBusMutation.mutate(data);
    } else {
      createBusMutation.mutate(data);
    }
  };

  const handleClose = () => {
    onClose();
    form.reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Bus" : "Crear Nuevo Bus"}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="plateNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Placa</FormLabel>
                    <FormControl>
                      <Input placeholder="P-001AAA" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="busNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Unidad</FormLabel>
                    <FormControl>
                      <Input placeholder="001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modelo</FormLabel>
                    <FormControl>
                      <Input placeholder="Mercedes Benz LO 915" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Año</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1990" 
                        max={new Date().getFullYear() + 1} 
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacidad (pasajeros)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1" 
                        max="100" 
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar estado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="disponible">Disponible</SelectItem>
                        <SelectItem value="en_servicio">En Servicio</SelectItem>
                        <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                        <SelectItem value="fuera_de_servicio">Fuera de Servicio</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createBusMutation.isPending || updateBusMutation.isPending}
                data-testid={isEditing ? "button-update-bus" : "button-create-bus"}
              >
                {(createBusMutation.isPending || updateBusMutation.isPending) ? "Guardando..." : (isEditing ? "Actualizar" : "Crear")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}