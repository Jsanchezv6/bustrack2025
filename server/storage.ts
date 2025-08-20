import { 
  type User, 
  type InsertUser, 
  type Schedule, 
  type InsertSchedule,
  type Assignment,
  type InsertAssignment,
  type Location,
  type InsertLocation,
  users,
  schedules,
  assignments,
  locations
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllDrivers(): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, user: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  // Schedules
  getAllSchedules(): Promise<Schedule[]>;
  getSchedule(id: string): Promise<Schedule | undefined>;
  createSchedule(schedule: InsertSchedule): Promise<Schedule>;
  updateSchedule(id: string, schedule: Partial<Schedule>): Promise<Schedule | undefined>;
  deleteSchedule(id: string): Promise<boolean>;

  // Assignments
  getAllAssignments(): Promise<Assignment[]>;
  getAssignmentsByDriverId(driverId: string): Promise<Assignment[]>;
  getActiveAssignmentByDriverId(driverId: string): Promise<Assignment | undefined>;
  createAssignment(assignment: InsertAssignment): Promise<Assignment>;
  deleteAssignment(id: string): Promise<boolean>;

  // Locations
  updateDriverLocation(location: InsertLocation): Promise<Location>;
  getDriverLocation(driverId: string): Promise<Location | undefined>;
  getAllActiveLocations(): Promise<Location[]>;
  setDriverTransmissionStatus(driverId: string, isTransmitting: boolean): Promise<void>;
  stopDriverTransmission(driverId: string): Promise<void>;
}

// Implementación de almacenamiento con base de datos PostgreSQL
export class DatabaseStorage implements IStorage {
  constructor() {
    // Inicializar datos por defecto al crear la instancia
    this.initializeDefaultData();
  }

  private async initializeDefaultData() {
    try {
      // Verificar si ya existen usuarios
      const existingUsers = await db.select().from(users).limit(1);
      if (existingUsers.length > 0) {
        return; // Ya hay datos inicializados
      }

      // Crear usuario administrador por defecto con contraseña hasheada
      const hashedAdminPassword = await bcrypt.hash("admin123", 10);
      const [admin] = await db.insert(users).values({
        username: "admin",
        password: hashedAdminPassword,
        role: "admin",
        fullName: "Administrador Sistema",
        licenseNumber: null,
      }).returning();

      // Crear chofer por defecto con contraseña hasheada
      const hashedDriverPassword = await bcrypt.hash("chofer123", 10);
      const [driver] = await db.insert(users).values({
        username: "chofer1",
        password: hashedDriverPassword,
        role: "driver",
        fullName: "Juan Pérez",
        licenseNumber: "A1234567",
      }).returning();

      // Crear horario de muestra
      const [schedule] = await db.insert(schedules).values({
        routeName: "Centro - Universidad",
        routeNumber: 1,
        startTime: "06:00",
        endTime: "22:00",
        isActive: true,
      }).returning();

      // Crear asignación de muestra
      await db.insert(assignments).values({
        driverId: driver.id,
        scheduleId: schedule.id,
        assignedDate: new Date().toISOString().split('T')[0],
        shiftStart: "06:00",
        shiftEnd: "14:00",
        isActive: true,
      });

      console.log("Datos iniciales creados en la base de datos");
    } catch (error) {
      console.error("Error al inicializar datos por defecto:", error);
    }
  }

  // Métodos para Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Hashear la contraseña antes de guardar
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const userWithHashedPassword = {
      ...insertUser,
      password: hashedPassword
    };
    
    const [user] = await db
      .insert(users)
      .values(userWithHashedPassword)
      .returning();
    return user;
  }

  async getAllDrivers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, 'driver'));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User | undefined> {
    // Si se está actualizando la contraseña, hashearla
    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 10);
    }
    
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser || undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount || 0) > 0;
  }



  // Métodos para Schedules
  async getAllSchedules(): Promise<Schedule[]> {
    return await db.select().from(schedules);
  }

  async getSchedule(id: string): Promise<Schedule | undefined> {
    const [schedule] = await db.select().from(schedules).where(eq(schedules.id, id));
    return schedule || undefined;
  }

  async createSchedule(insertSchedule: InsertSchedule): Promise<Schedule> {
    const [schedule] = await db
      .insert(schedules)
      .values(insertSchedule)
      .returning();
    return schedule;
  }

  async updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule | undefined> {
    const [updated] = await db
      .update(schedules)
      .set(updates)
      .where(eq(schedules.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteSchedule(id: string): Promise<boolean> {
    const result = await db.delete(schedules).where(eq(schedules.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Métodos para Assignments
  async getAllAssignments(): Promise<Assignment[]> {
    return await db.select().from(assignments);
  }

  async getAssignmentsByDriverId(driverId: string): Promise<Assignment[]> {
    return await db.select().from(assignments).where(eq(assignments.driverId, driverId));
  }

  async getActiveAssignmentByDriverId(driverId: string): Promise<Assignment | undefined> {
    const today = new Date().toISOString().split('T')[0];
    const [assignment] = await db
      .select()
      .from(assignments)
      .where(
        and(
          eq(assignments.driverId, driverId),
          eq(assignments.isActive, true),
          eq(assignments.assignedDate, today)
        )
      );
    return assignment || undefined;
  }

  // Método para obtener todos los turnos activos de un chofer (perpetuos)
  async getActiveAssignmentsByDriverId(driverId: string): Promise<Assignment[]> {
    return await db
      .select()
      .from(assignments)
      .where(
        and(
          eq(assignments.driverId, driverId),
          eq(assignments.isActive, true)
        )
      )
      .orderBy(assignments.shiftStart);
  }

  // Método para obtener turno actual y siguiente
  async getCurrentAndNextShifts(driverId: string): Promise<{ current: Assignment | null, next: Assignment | null }> {
    const activeAssignments = await this.getActiveAssignmentsByDriverId(driverId);
    
    if (activeAssignments.length === 0) {
      return { current: null, next: null };
    }

    // Usar zona horaria de Guatemala (GMT-6)
    const now = new Date();
    const guatemalaTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Guatemala"}));
    const currentTime = `${String(guatemalaTime.getHours()).padStart(2, '0')}:${String(guatemalaTime.getMinutes()).padStart(2, '0')}`;
    
    let current: Assignment | null = null;
    let next: Assignment | null = null;

    // Buscar turno actual (donde la hora actual está entre shiftStart y shiftEnd)
    for (const assignment of activeAssignments) {
      if (currentTime >= assignment.shiftStart && currentTime <= assignment.shiftEnd) {
        current = assignment;
        break;
      }
    }

    // Buscar siguiente turno - algoritmo mejorado
    // 1. Buscar turnos que inician después de la hora actual
    let futureShifts = activeAssignments.filter(a => a.shiftStart > currentTime);
    
    if (futureShifts.length > 0) {
      // Hay turnos después de la hora actual
      next = futureShifts[0]; // El primero en orden alfabético será el más temprano
    } else {
      // No hay más turnos después de la hora actual, tomar el primer turno del día (ciclo)
      next = activeAssignments[0]; // El primero por orden de shiftStart
    }

    return { current, next };
  }

  async createAssignment(insertAssignment: InsertAssignment): Promise<Assignment> {
    const [assignment] = await db
      .insert(assignments)
      .values(insertAssignment)
      .returning();
    return assignment;
  }

  async deleteAssignment(id: string): Promise<boolean> {
    const result = await db.delete(assignments).where(eq(assignments.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Métodos para Locations
  async updateDriverLocation(insertLocation: InsertLocation): Promise<Location> {
    // Buscar ubicación existente para el chofer
    const [existingLocation] = await db
      .select()
      .from(locations)
      .where(eq(locations.driverId, insertLocation.driverId));

    if (existingLocation) {
      // Actualizar ubicación existente
      const [updated] = await db
        .update(locations)
        .set({
          latitude: insertLocation.latitude,
          longitude: insertLocation.longitude,
          isTransmitting: insertLocation.isTransmitting,
          timestamp: new Date(),
        })
        .where(eq(locations.id, existingLocation.id))
        .returning();
      return updated;
    } else {
      // Crear nueva ubicación
      const [location] = await db
        .insert(locations)
        .values(insertLocation)
        .returning();
      return location;
    }
  }

  async getDriverLocation(driverId: string): Promise<Location | undefined> {
    const [location] = await db
      .select()
      .from(locations)
      .where(eq(locations.driverId, driverId));
    return location || undefined;
  }

  async getAllActiveLocations(): Promise<Location[]> {
    return await db
      .select()
      .from(locations)
      .where(eq(locations.isTransmitting, true));
  }

  async setDriverTransmissionStatus(driverId: string, isTransmitting: boolean): Promise<void> {
    await db
      .update(locations)
      .set({ 
        isTransmitting,
        timestamp: new Date()
      })
      .where(eq(locations.driverId, driverId));
  }

  async stopDriverTransmission(driverId: string): Promise<void> {
    await db
      .update(locations)
      .set({ 
        isTransmitting: false,
        timestamp: new Date()
      })
      .where(eq(locations.driverId, driverId));
  }
}

export const storage = new DatabaseStorage();
