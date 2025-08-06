import { useState, useEffect } from 'react';
import { authManager, type AuthUser } from '@/lib/auth';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(authManager.getCurrentUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Suscribirse a cambios en el estado de autenticación
    const unsubscribe = authManager.subscribe(setUser);
    
    // Verificar sesión al montar el componente
    const checkSession = async () => {
      if (user) {
        await authManager.checkSession();
      }
      setLoading(false);
    };
    
    checkSession();

    return unsubscribe;
  }, [user]);

  const login = authManager.setCurrentUser.bind(authManager);
  const logout = async () => await authManager.logout();
  const isAdmin = authManager.isAdmin.bind(authManager);
  const isDriver = authManager.isDriver.bind(authManager);

  return {
    user,
    loading,
    login,
    logout,
    isAdmin,
    isDriver,
    isAuthenticated: !!user
  };
}