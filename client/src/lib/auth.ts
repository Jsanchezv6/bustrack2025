import { User } from "@shared/schema";

export interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'driver';
  fullName: string;
  licenseNumber: string | null;
}

class AuthManager {
  private currentUser: AuthUser | null = null;
  private listeners: ((user: AuthUser | null) => void)[] = [];

  getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  setCurrentUser(user: AuthUser | null): void {
    this.currentUser = user;
    this.notifyListeners();
  }

  subscribe(listener: (user: AuthUser | null) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentUser));
  }

  isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }

  isDriver(): boolean {
    return this.currentUser?.role === 'driver';
  }

  logout(): void {
    this.setCurrentUser(null);
  }
}

export const authManager = new AuthManager();
