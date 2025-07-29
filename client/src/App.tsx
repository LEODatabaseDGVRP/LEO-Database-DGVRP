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
import DiscordCallbackPage from "@/pages/discord-callback";
import AdminPanel from "./pages/admin-panel";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  console.log("Auth state:", { isAuthenticated, isLoading });

  // Force redirect to login if on root and not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      if (location === "/" || location === "") {
        console.log("Redirecting from root to login - using router navigation");
        setLocation("/login");
      }
    }
  }, [isLoading, isAuthenticated, location, setLocation]);

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--law-primary)" }}>
        <div className="text-white text-xl">Loading authentication...</div>
      </div>
    );
  }

  // Handle the transition period when authentication state is changing
  if (isAuthenticated && (location.startsWith("/login") || location.startsWith("/signup"))) {
    // User is authenticated but still on login/signup page, redirect to home
    setLocation("/");
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--law-primary)" }}>
        <div className="text-white text-xl">Redirecting...</div>
      </div>
    );
  }

  // If not authenticated, show login/signup pages
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/signup" component={SimpleSignupPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/discord-callback" component={DiscordCallbackPage} />
        <Route path="/login" component={SimpleLoginPage} />
        <Route path="/" component={SimpleLoginPage} />
        <Route component={SimpleLoginPage} />
      </Switch>
    );
  }

  // If authenticated, show app pages with smooth transition
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--law-primary)" }}>
      <Switch>
        <Route path="/" component={Selection} />
        <Route path="/home" component={Home} />
        <Route path="/citation" component={CitationForm} />
        <Route path="/arrest" component={ArrestForm} />
        <Route path="/admin" component={AdminPanel} />
        <Route>
          {/* Custom not found for authenticated users */}
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center text-white">
              <h1 className="text-4xl font-bold mb-4">Page Not Found</h1>
              <p className="text-slate-300 mb-6">The page you're looking for doesn't exist.</p>
              <button 
                onClick={() => setLocation("/")} 
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Back to Selection
              </button>
            </div>
          </div>
        </Route>
      </Switch>
    </div>
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