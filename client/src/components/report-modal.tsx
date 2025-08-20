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
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertReportSchema } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AlertTriangle } from "lucide-react";

// Esquema extendido para el formulario con validaciones localizadas
const reportFormSchema = insertReportSchema.extend({
  type: z.enum(["atraso", "incidente", "otro"], {
    errorMap: () => ({ message: "Debe seleccionar un tipo de reporte" }),
  }),
  description: z
    .string()
    .min(10, "La descripción debe tener al menos 10 caracteres")
    .max(500, "La descripción no puede exceder 500 caracteres"),
});

type ReportFormData = z.infer<typeof reportFormSchema>;

interface ReportModalProps {
  driverId: string;
}

export function ReportModal({ driverId }: ReportModalProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ReportFormData>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      driverId,
      type: undefined,
      description: "",
    },
  });

  const createReportMutation = useMutation({
    mutationFn: (data: ReportFormData) =>
      apiRequest('POST', '/api/reports', data),
    onSuccess: () => {
      toast({
        title: "Reporte enviado",
        description: "Su reporte ha sido enviado exitosamente.",
      });
      form.reset({
        driverId,
        type: undefined,
        description: "",
      });
      setOpen(false);
      
      // Invalidar las consultas de reportes para refrescar la lista
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
    },
    onError: (error: any) => {
      console.error("Error enviando reporte:", error);
      toast({
        title: "Error",
        description: "No se pudo enviar el reporte. Intente nuevamente.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ReportFormData) => {
    createReportMutation.mutate(data);
  };

  const reportTypes = [
    { value: "atraso", label: "Atraso" },
    { value: "incidente", label: "Incidente" },
    { value: "otro", label: "Otro" }
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="w-full"
          data-testid="button-report-incident"
        >
          <AlertTriangle className="mr-2 h-4 w-4" />
          Reportar Incidente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reportar Incidente</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Reporte *</FormLabel>
                  <FormControl>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      data-testid="select-report-type"
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione el tipo de reporte" />
                      </SelectTrigger>
                      <SelectContent>
                        {reportTypes.map((type) => (
                          <SelectItem 
                            key={type.value} 
                            value={type.value}
                            data-testid={`option-${type.value}`}
                          >
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe brevemente lo ocurrido..."
                      className="min-h-[100px]"
                      {...field}
                      data-testid="textarea-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createReportMutation.isPending}
                data-testid="button-send-report"
              >
                {createReportMutation.isPending ? "Enviando..." : "Enviar Reporte"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}