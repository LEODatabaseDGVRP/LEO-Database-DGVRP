import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import CitationForm from "@/pages/citation-form";
import Selection from "@/pages/selection";
import ArrestForm from "@/pages/arrest-form";
import SimpleLoginPage from "@/pages/simple-login";
import SimpleSignupPage from "@/pages/simple-signup";
import ForgotPasswordPage from "@/pages/forgot-password";
import AdminPanel from "./pages/admin-panel";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  console.log("Auth state:", { isAuthenticated, isLoading });

  // Force redirect to login if on root and not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      if (location === "/" || location === "") {
        console.log("Redirecting from root to login - forcing page reload");
        window.location.replace("/login");
      }
    }
  }, [isLoading, isAuthenticated, location]);

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--law-primary)" }}>
        <div className="text-white text-xl">Loading authentication...</div>
      </div>
    );
  }

  // If not authenticated, show login/signup pages
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/signup" component={SimpleSignupPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/login" component={SimpleLoginPage} />
        <Route path="/" component={SimpleLoginPage} />
        <Route component={SimpleLoginPage} />
      </Switch>
    );
  }

  // If authenticated, show app pages
  return (
    <Switch>
      <Route path="/" component={Selection} />
      <Route path="/home" component={Home} />
      <Route path="/citation" component={CitationForm} />
      <Route path="/arrest" component={ArrestForm} />
      <Route path="/admin" component={AdminPanel} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <div className="dark">
          <Router />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;