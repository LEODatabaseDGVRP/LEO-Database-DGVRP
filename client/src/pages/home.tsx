import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

export default function Home() {
  const { user, refetch } = useAuth();
  const { toast } = useToast();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/logout");
      if (!response.ok) {
        throw new Error("Logout failed");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "✅ Logged Out Successfully",
        description: "You have been logged out of the system.",
      });
      // Refetch auth state to update UI
      refetch();
      // Redirect to login page
      window.location.href = "/login";
    },
    onError: (error: any) => {
      toast({
        title: "❌ Logout Failed",
        description: error.message || "Unable to logout. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: "var(--law-primary)" }}>
      <div className="max-w-4xl mx-auto">
        {/* Header with user info and logout */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Law Enforcement Portal</h1>
            <p className="text-gray-300">Welcome back, {user?.username}</p>
          </div>
          <Button 
            onClick={handleLogout}
            variant="outline"
            className="text-red-400 border-red-400 hover:bg-red-400 hover:text-white"
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? "Logging out..." : "Logout"}
          </Button>
        </div>

        {/* Main action cards */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="law-card">
            <CardHeader>
              <CardTitle className="text-white text-xl">Citation Form</CardTitle>
              <CardDescription className="text-gray-300">
                Create and submit traffic violation citations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/citation">
                <Button className="w-full law-accent-btn text-white">
                  Create Citation
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="law-card">
            <CardHeader>
              <CardTitle className="text-white text-xl">Arrest Form</CardTitle>
              <CardDescription className="text-gray-300">
                Complete arrest reports and documentation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/arrest">
                <Button className="w-full law-accent-btn text-white">
                  Create Arrest Report
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>Officer Information is automatically saved between form submissions</p>
          <p>All citations are sent to Discord for processing when configured</p>
        </div>
      </div>
    </div>
  );
}