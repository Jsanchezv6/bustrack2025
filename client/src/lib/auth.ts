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

  constructor() {
    // Restaurar sesión desde localStorage al inicializar
    this.loadFromStorage();
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  setCurrentUser(user: AuthUser | null): void {
    this.currentUser = user;
    if (user) {
      // Guardar sesión en localStorage
      localStorage.setItem('busapp_user', JSON.stringify(user));
    } else {
      // Eliminar sesión del localStorage
      localStorage.removeItem('busapp_user');
    }
    this.notifyListeners();
  }

  private loadFromStorage(): void {
    try {
      const storedUser = localStorage.getItem('busapp_user');
      if (storedUser) {
        this.currentUser = JSON.parse(storedUser);
      }
    } catch (error) {
      console.error('Error al cargar sesión:', error);
      localStorage.removeItem('busapp_user');
    }
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

  // Método para verificar y renovar sesión si es necesario
  async checkSession(): Promise<boolean> {
    if (!this.currentUser) return false;
    
    try {
      // Verificar que la sesión sigue siendo válida con el servidor
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.currentUser.id })
      });
      
      if (!response.ok) {
        this.logout();
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error verificando sesión:', error);
      return true; // Mantener sesión en caso de error de red
    }
  }
}

export const authManager = new AuthManager();
