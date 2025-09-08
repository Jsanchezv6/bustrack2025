import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { z } from "zod";
import bcrypt from "bcrypt";
import { 
  loginSchema, 
  insertRouteSchema,
  insertBusSchema,
  insertAssignmentSchema,
  insertLocationSchema,
  insertUserSchema,
  insertReportSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket server for real-time location updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store active WebSocket connections
  const driverConnections = new Map<string, WebSocket>();

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      // Verificar contraseña hasheada con bcrypt
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      // Autenticación exitosa
      res.json({
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        licenseNumber: user.licenseNumber,
        driverStatus: user.driverStatus,
      });
    } catch (error) {
      console.error('Error en login:', error);
      res.status(400).json({ message: "Datos de login inválidos" });
    }
  });

  // Verificar sesión
  app.post("/api/auth/verify", async (req, res) => {
    try {
      const { userId } = req.body;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: "Sesión inválida" });
      }
      
      res.json({ valid: true });
    } catch (error) {
      res.status(401).json({ message: "Sesión inválida" });
    }
  });

  // Schedule routes
  app.get("/api/schedules", async (req, res) => {
    try {
      const schedules = await storage.getAllSchedules();
      res.json(schedules);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener rutas" });
    }
  });

  app.get("/api/schedules/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const schedule = await storage.getSchedule(id);
      
      if (!schedule) {
        return res.status(404).json({ message: "Ruta no encontrada" });
      }
      
      res.json(schedule);
    } catch (error) {
      console.error('Error getting schedule by ID:', error);
      res.status(500).json({ message: "Error al obtener ruta" });
    }
  });

  app.post("/api/schedules", async (req, res) => {
    try {
      const scheduleData = insertRouteSchema.parse(req.body);
      const schedule = await storage.createSchedule(scheduleData);
      res.json(schedule);
    } catch (error) {
      res.status(400).json({ message: "Datos de ruta inválidos" });
    }
  });

  app.put("/api/schedules/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const schedule = await storage.updateSchedule(id, updates);
      
      if (!schedule) {
        return res.status(404).json({ message: "Ruta no encontrada" });
      }
      
      res.json(schedule);
    } catch (error) {
      res.status(500).json({ message: "Error al actualizar horario" });
    }
  });

  app.delete("/api/schedules/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteSchedule(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Ruta no encontrada" });
      }
      
      res.json({ message: "Horario eliminado" });
    } catch (error) {
      res.status(500).json({ message: "Error al eliminar horario" });
    }
  });

  // Bus routes
  app.get("/api/buses", async (req, res) => {
    try {
      const buses = await storage.getAllBuses();
      res.json(buses);
    } catch (error) {
      console.error('Error getting buses:', error);
      res.status(500).json({ message: "Error al obtener buses" });
    }
  });

  app.get("/api/buses/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const bus = await storage.getBus(id);
      
      if (!bus) {
        return res.status(404).json({ message: "Bus no encontrado" });
      }
      
      res.json(bus);
    } catch (error) {
      console.error('Error getting bus by ID:', error);
      res.status(500).json({ message: "Error al obtener bus" });
    }
  });

  app.post("/api/buses", async (req, res) => {
    try {
      const busData = insertBusSchema.parse(req.body);
      const bus = await storage.createBus(busData);
      res.json(bus);
    } catch (error) {
      console.error('Error creating bus:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      } else {
        res.status(500).json({ message: "Error interno del servidor" });
      }
    }
  });

  app.put("/api/buses/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const bus = await storage.updateBus(id, updates);
      
      if (!bus) {
        return res.status(404).json({ message: "Bus no encontrado" });
      }
      
      res.json(bus);
    } catch (error) {
      console.error('Error updating bus:', error);
      res.status(500).json({ message: "Error al actualizar bus" });
    }
  });

  app.delete("/api/buses/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteBus(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Bus no encontrado" });
      }
      
      res.json({ message: "Bus eliminado" });
    } catch (error) {
      console.error('Error deleting bus:', error);
      res.status(500).json({ message: "Error al eliminar bus" });
    }
  });

  // Assignment routes
  app.get("/api/assignments", async (req, res) => {
    try {
      const assignments = await storage.getAllAssignments();
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener asignaciones" });
    }
  });

  app.get("/api/assignments/driver/:driverId", async (req, res) => {
    try {
      const { driverId } = req.params;
      const assignments = await storage.getActiveAssignmentsByDriverId(driverId);
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener asignaciones" });
    }
  });

  // Nuevo endpoint para obtener turnos actual y siguiente
  app.get("/api/assignments/driver/:driverId/shifts", async (req, res) => {
    try {
      const { driverId } = req.params;
      const shifts = await storage.getCurrentAndNextShifts(driverId);
      res.json(shifts);
    } catch (error) {
      console.error('Error getting driver shifts:', error);
      res.status(500).json({ message: "Error al obtener turnos del chofer" });
    }
  });

  app.post("/api/assignments", async (req, res) => {
    try {
      const assignmentData = insertAssignmentSchema.parse(req.body);
      const assignment = await storage.createAssignment(assignmentData);
      res.json(assignment);
    } catch (error) {
      res.status(400).json({ message: "Datos de asignación inválidos" });
    }
  });

  app.delete("/api/assignments/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteAssignment(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Asignación no encontrada" });
      }
      
      res.json({ message: "Asignación eliminada" });
    } catch (error) {
      res.status(500).json({ message: "Error al eliminar asignación" });
    }
  });

  // Driver routes
  app.get("/api/drivers", async (req, res) => {
    try {
      const drivers = await storage.getAllDrivers();
      res.json(drivers);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener choferes" });
    }
  });

  // Users management endpoints
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error('Error getting users:', error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.json(user);
    } catch (error) {
      console.error('Error creating user:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      } else {
        res.status(500).json({ message: "Error interno del servidor" });
      }
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userData = req.body;
      const updatedUser = await storage.updateUser(userId, userData);
      if (!updatedUser) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const deleted = await storage.deleteUser(userId);
      if (!deleted) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Update driver status
  app.put("/api/users/:id/status", async (req, res) => {
    try {
      const userId = req.params.id;
      const statusSchema = z.object({
        driverStatus: z.enum(["disponible", "en_ruta_cargar", "en_ruta_descargar", "cargando", "descargando", "no_disponible"])
      });
      
      const { driverStatus } = statusSchema.parse(req.body);
      const updatedUser = await storage.updateUser(userId, { driverStatus });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      res.json({
        success: true,
        user: {
          id: updatedUser.id,
          driverStatus: updatedUser.driverStatus
        }
      });
    } catch (error) {
      console.error('Error updating driver status:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Estado inválido", errors: error.errors });
      } else {
        res.status(500).json({ message: "Error interno del servidor" });
      }
    }
  });



  // Location routes
  app.get("/api/locations", async (req, res) => {
    try {
      const locations = await storage.getAllActiveLocations();
      res.json(locations);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener ubicaciones" });
    }
  });

  app.post("/api/locations", async (req, res) => {
    try {
      console.log('POST /api/locations - Datos recibidos:', req.body);
      const locationData = insertLocationSchema.parse(req.body);
      console.log('POST /api/locations - Datos validados:', locationData);
      const location = await storage.updateDriverLocation(locationData);
      console.log('POST /api/locations - Ubicación guardada:', location);
      
      // Broadcast location update to all admin connections
      const locationUpdate = {
        type: 'locationUpdate',
        data: location
      };
      
      driverConnections.forEach((ws, connectionId) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(locationUpdate));
        }
      });
      
      res.json(location);
    } catch (error) {
      console.error('Error POST /api/locations:', error);
      res.status(400).json({ message: "Datos de ubicación inválidos", error: error instanceof Error ? error.message : 'Error desconocido' });
    }
  });

  // Endpoint para detener transmisión
  app.post("/api/locations/stop-transmission", async (req, res) => {
    try {
      const { driverId } = req.body;
      if (!driverId) {
        return res.status(400).json({ message: "Driver ID requerido" });
      }

      console.log(`Deteniendo transmisión para chofer: ${driverId}`);
      
      // Actualizar el estado de transmisión a false en la base de datos
      await storage.stopDriverTransmission(driverId);
      
      // Broadcast stop transmission update to all admin connections
      const stopTransmissionUpdate = {
        type: 'transmissionStopped',
        data: { driverId, isTransmitting: false }
      };
      
      console.log(`Enviando WebSocket a ${driverConnections.size} conexiones:`, stopTransmissionUpdate);
      
      let sentCount = 0;
      driverConnections.forEach((ws, connectionId) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(stopTransmissionUpdate));
          sentCount++;
        } else {
          console.log(`Conexión ${connectionId} cerrada, removiendo...`);
          driverConnections.delete(connectionId);
        }
      });
      
      console.log(`Mensaje WebSocket enviado a ${sentCount} conexiones activas`);

      res.json({ success: true, message: "Transmisión detenida" });
    } catch (error) {
      console.error('Error deteniendo transmisión:', error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Report routes
  app.get("/api/reports", async (req, res) => {
    try {
      const reports = await storage.getAllReports();
      res.json(reports);
    } catch (error) {
      console.error('Error obteniendo reportes:', error);
      res.status(500).json({ message: "Error al obtener reportes" });
    }
  });

  app.post("/api/reports", async (req, res) => {
    try {
      const reportData = insertReportSchema.parse(req.body);
      const report = await storage.createReport(reportData);
      res.json(report);
    } catch (error) {
      console.error('Error creando reporte:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      } else {
        res.status(500).json({ message: "Error interno del servidor" });
      }
    }
  });

  app.get("/api/reports/driver/:driverId", async (req, res) => {
    try {
      const driverId = req.params.driverId;
      const reports = await storage.getReportsByDriverId(driverId);
      res.json(reports);
    } catch (error) {
      console.error('Error obteniendo reportes del chofer:', error);
      res.status(500).json({ message: "Error al obtener reportes del chofer" });
    }
  });

  // WebSocket handling
  wss.on('connection', (ws, req) => {
    const connectionId = Math.random().toString(36).substring(7);
    driverConnections.set(connectionId, ws);

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'locationUpdate') {
          // Update location in storage
          await storage.updateDriverLocation(data.location);
          
          // Broadcast to all other connections
          const locationUpdate = {
            type: 'locationUpdate',
            data: data.location
          };
          
          driverConnections.forEach((connection, id) => {
            if (id !== connectionId && connection.readyState === WebSocket.OPEN) {
              connection.send(JSON.stringify(locationUpdate));
            }
          });
        }

        if (data.type === 'transmissionStatus') {
          await storage.setDriverTransmissionStatus(data.driverId, data.isTransmitting);
          
          // Broadcast status change
          const statusUpdate = {
            type: 'transmissionStatusUpdate',
            data: {
              driverId: data.driverId,
              isTransmitting: data.isTransmitting
            }
          };
          
          driverConnections.forEach((connection, id) => {
            if (connection.readyState === WebSocket.OPEN) {
              connection.send(JSON.stringify(statusUpdate));
            }
          });
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      driverConnections.delete(connectionId);
    });

    // Send initial data
    ws.send(JSON.stringify({
      type: 'connected',
      connectionId
    }));
  });

  return httpServer;
}
