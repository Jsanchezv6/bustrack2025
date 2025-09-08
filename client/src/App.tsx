import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import Login from "@/pages/login";
import AdminDashboard from "@/pages/admin-dashboard";
import DriverDashboard from "@/pages/driver-dashboard";
import PassengerView from "@/pages/passenger-view";
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
      <Route path="/passenger">
        <PassengerView onBackToLogin={() => window.location.href = '/'} />
      </Route>
      <Route path="/login">
        <Login />
      </Route>
      <Route path="/">
        {!user ? <Login /> : user.role === 'admin' ? <AdminDashboard /> : <DriverDashboard />}
      </Route>
      <Route path="/admin">
        {user?.role === 'admin' ? <AdminDashboard /> : <Login />}
      </Route>
      <Route path="/driver">
        {user?.role === 'driver' ? <DriverDashboard /> : <Login />}
      </Route>
      <Route component={NotFound} />
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
