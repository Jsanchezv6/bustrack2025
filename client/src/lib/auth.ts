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
    console.log('AuthManager - Estableciendo usuario:', user);
    this.currentUser = user;
    if (user) {
      // Guardar sesión en localStorage
      localStorage.setItem('busapp_user', JSON.stringify(user));
      console.log('AuthManager - Usuario guardado en localStorage:', user.id);
    } else {
      // Eliminar sesión del localStorage
      localStorage.removeItem('busapp_user');
      console.log('AuthManager - Sesión eliminada');
    }
    this.notifyListeners();
  }

  private loadFromStorage(): void {
    try {
      const storedUser = localStorage.getItem('busapp_user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        console.log('AuthManager - Cargando usuario desde localStorage:', user);
        
        // Verificar que el usuario tenga un ID válido
        if (user && user.id && user.username) {
          this.currentUser = user;
        } else {
          console.warn('AuthManager - Usuario inválido en localStorage, eliminando');
          localStorage.removeItem('busapp_user');
        }
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

  async logout(): Promise<void> {
    // Si el usuario actual es un chofer, detener transmisión antes de cerrar sesión
    if (this.currentUser && this.currentUser.role === 'driver') {
      try {
        await fetch('/api/locations/stop-transmission', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driverId: this.currentUser.id })
        });
        console.log('AuthManager - Transmisión detenida al cerrar sesión');
      } catch (error) {
        console.error('Error deteniendo transmisión al cerrar sesión:', error);
      }
    }
    
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
        console.warn('AuthManager - Sesión inválida en servidor, cerrando sesión');
        this.logout();
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error verificando sesión:', error);
      return true; // Mantener sesión en caso de error de red
    }
  }

  // Método para limpiar y revalidar localStorage
  clearInvalidSession(): void {
    console.log('AuthManager - Limpiando sesión inválida');
    localStorage.removeItem('busapp_user');
    this.currentUser = null;
    this.notifyListeners();
  }
}

export const authManager = new AuthManager();
