import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { authManager, AuthUser } from "@/lib/auth";
import Login from "@/pages/login";
import AdminDashboard from "@/pages/admin-dashboard";
import DriverDashboard from "@/pages/driver-dashboard";
import NotFound from "@/pages/not-found";

function Router() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const unsubscribe = authManager.subscribe(setCurrentUser);
    setCurrentUser(authManager.getCurrentUser());
    return unsubscribe;
  }, []);

  if (!currentUser) {
    return <Login onLoginSuccess={() => setCurrentUser(authManager.getCurrentUser())} />;
  }

  return (
    <Switch>
      <Route path="/">
        {currentUser.role === 'admin' ? <AdminDashboard /> : <DriverDashboard />}
      </Route>
      <Route path="/admin">
        {currentUser.role === 'admin' ? <AdminDashboard /> : <NotFound />}
      </Route>
      <Route path="/driver">
        {currentUser.role === 'driver' ? <DriverDashboard /> : <NotFound />}
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
