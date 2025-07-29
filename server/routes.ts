import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { z } from "zod";
import { 
  loginSchema, 
  insertScheduleSchema, 
  insertAssignmentSchema,
  insertLocationSchema,
  insertUserSchema
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
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      // In production, use proper session management
      res.json({
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        licenseNumber: user.licenseNumber,
      });
    } catch (error) {
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
      res.status(500).json({ message: "Error al obtener horarios" });
    }
  });

  app.post("/api/schedules", async (req, res) => {
    try {
      const scheduleData = insertScheduleSchema.parse(req.body);
      const schedule = await storage.createSchedule(scheduleData);
      res.json(schedule);
    } catch (error) {
      res.status(400).json({ message: "Datos de horario inválidos" });
    }
  });

  app.put("/api/schedules/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const schedule = await storage.updateSchedule(id, updates);
      
      if (!schedule) {
        return res.status(404).json({ message: "Horario no encontrado" });
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
        return res.status(404).json({ message: "Horario no encontrado" });
      }
      
      res.json({ message: "Horario eliminado" });
    } catch (error) {
      res.status(500).json({ message: "Error al eliminar horario" });
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
      const assignment = await storage.getActiveAssignmentByDriverId(driverId);
      res.json(assignment);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener asignación" });
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
      const locationData = insertLocationSchema.parse(req.body);
      const location = await storage.updateDriverLocation(locationData);
      
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
      res.status(400).json({ message: "Datos de ubicación inválidos" });
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
