import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import Login from "@/pages/login";
import AdminDashboard from "@/pages/admin-dashboard";
import DriverDashboard from "@/pages/driver-dashboard";
import PassengerDashboard from "@/pages/passenger-dashboard";
import NotFound from "@/pages/not-found";

function Router() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Ruta pública para pasajeros - sin autenticación requerida */}
      <Route path="/pasajeros">
        <PassengerDashboard />
      </Route>
      
      {/* Rutas que requieren autenticación */}
      {!user ? (
        <Route>
          <Login />
        </Route>
      ) : (
        <>
          <Route path="/">
            {user.role === 'admin' ? <AdminDashboard /> : <DriverDashboard />}
          </Route>
          <Route path="/admin">
            {user.role === 'admin' ? <AdminDashboard /> : <NotFound />}
          </Route>
          <Route path="/driver">
            {user.role === 'driver' ? <DriverDashboard /> : <NotFound />}
          </Route>
          <Route component={NotFound} />
        </>
      )}
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
