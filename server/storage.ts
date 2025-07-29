import { 
  type User, 
  type InsertUser, 
  type Schedule, 
  type InsertSchedule,
  type Assignment,
  type InsertAssignment,
  type Location,
  type InsertLocation
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllDrivers(): Promise<User[]>;

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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private schedules: Map<string, Schedule>;
  private assignments: Map<string, Assignment>;
  private locations: Map<string, Location>;

  constructor() {
    this.users = new Map();
    this.schedules = new Map();
    this.assignments = new Map();
    this.locations = new Map();

    // Initialize with default admin and driver users
    this.initializeDefaultData();
  }

  private async initializeDefaultData() {
    // Create default admin
    const admin: User = {
      id: randomUUID(),
      username: "admin",
      password: "admin123", // In production, this should be hashed
      role: "admin",
      fullName: "Administrador Sistema",
      licenseNumber: null,
      createdAt: new Date(),
    };
    this.users.set(admin.id, admin);

    // Create default driver
    const driver: User = {
      id: randomUUID(),
      username: "chofer1",
      password: "chofer123", // In production, this should be hashed
      role: "driver",
      fullName: "Juan Pérez",
      licenseNumber: "A1234567",
      createdAt: new Date(),
    };
    this.users.set(driver.id, driver);

    // Create sample schedule
    const schedule: Schedule = {
      id: randomUUID(),
      routeName: "Centro - Universidad",
      routeNumber: 1,
      startTime: "06:00",
      endTime: "22:00",
      frequency: 15,
      isActive: true,
      createdAt: new Date(),
    };
    this.schedules.set(schedule.id, schedule);

    // Create sample assignment
    const assignment: Assignment = {
      id: randomUUID(),
      driverId: driver.id,
      scheduleId: schedule.id,
      assignedDate: new Date().toISOString().split('T')[0],
      shiftStart: "06:00",
      shiftEnd: "14:00",
      isActive: true,
      createdAt: new Date(),
    };
    this.assignments.set(assignment.id, assignment);
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async getAllDrivers(): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.role === 'driver');
  }

  // Schedules
  async getAllSchedules(): Promise<Schedule[]> {
    return Array.from(this.schedules.values());
  }

  async getSchedule(id: string): Promise<Schedule | undefined> {
    return this.schedules.get(id);
  }

  async createSchedule(insertSchedule: InsertSchedule): Promise<Schedule> {
    const id = randomUUID();
    const schedule: Schedule = {
      ...insertSchedule,
      id,
      createdAt: new Date(),
    };
    this.schedules.set(id, schedule);
    return schedule;
  }

  async updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule | undefined> {
    const existing = this.schedules.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...updates };
    this.schedules.set(id, updated);
    return updated;
  }

  async deleteSchedule(id: string): Promise<boolean> {
    return this.schedules.delete(id);
  }

  // Assignments
  async getAllAssignments(): Promise<Assignment[]> {
    return Array.from(this.assignments.values());
  }

  async getAssignmentsByDriverId(driverId: string): Promise<Assignment[]> {
    return Array.from(this.assignments.values()).filter(
      assignment => assignment.driverId === driverId
    );
  }

  async getActiveAssignmentByDriverId(driverId: string): Promise<Assignment | undefined> {
    const today = new Date().toISOString().split('T')[0];
    return Array.from(this.assignments.values()).find(
      assignment => 
        assignment.driverId === driverId && 
        assignment.isActive && 
        assignment.assignedDate === today
    );
  }

  async createAssignment(insertAssignment: InsertAssignment): Promise<Assignment> {
    const id = randomUUID();
    const assignment: Assignment = {
      ...insertAssignment,
      id,
      createdAt: new Date(),
    };
    this.assignments.set(id, assignment);
    return assignment;
  }

  async deleteAssignment(id: string): Promise<boolean> {
    return this.assignments.delete(id);
  }

  // Locations
  async updateDriverLocation(insertLocation: InsertLocation): Promise<Location> {
    // Find existing location for driver or create new one
    const existingLocation = Array.from(this.locations.values()).find(
      loc => loc.driverId === insertLocation.driverId
    );

    if (existingLocation) {
      const updated: Location = {
        ...existingLocation,
        latitude: insertLocation.latitude,
        longitude: insertLocation.longitude,
        isTransmitting: insertLocation.isTransmitting,
        timestamp: new Date(),
      };
      this.locations.set(existingLocation.id, updated);
      return updated;
    } else {
      const id = randomUUID();
      const location: Location = {
        ...insertLocation,
        id,
        timestamp: new Date(),
      };
      this.locations.set(id, location);
      return location;
    }
  }

  async getDriverLocation(driverId: string): Promise<Location | undefined> {
    return Array.from(this.locations.values()).find(
      loc => loc.driverId === driverId
    );
  }

  async getAllActiveLocations(): Promise<Location[]> {
    return Array.from(this.locations.values()).filter(
      loc => loc.isTransmitting
    );
  }

  async setDriverTransmissionStatus(driverId: string, isTransmitting: boolean): Promise<void> {
    const location = Array.from(this.locations.values()).find(
      loc => loc.driverId === driverId
    );

    if (location) {
      const updated = { ...location, isTransmitting, timestamp: new Date() };
      this.locations.set(location.id, updated);
    }
  }
}

export const storage = new MemStorage();
