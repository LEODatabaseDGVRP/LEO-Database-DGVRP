import { Link } from "wouter";
import { FileText, UserX, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function SelectionPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Logout failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Logged out successfully",
        description: "You have been logged out of the system.",
      });
    },
    onError: (error: any) => {
      console.error("Logout error:", error);
      toast({
        title: "Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6"
      style={{ 
        backgroundColor: "#2d3748"
      }}
    >
      {/* Logout button - positioned absolutely in top right */}
      <div className="absolute top-6 right-6">
        <Button 
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          variant="outline" 
          size="sm" 
          className="text-white border-white hover:bg-white hover:text-gray-800"
        >
          <LogOut className="w-4 h-4 mr-2" />
          {logoutMutation.isPending ? "Logging out..." : "Logout"}
        </Button>
      </div>

      {/* Admin button if user is admin */}
      {user?.isAdmin === true && ( // This line checks if the user is admin
        <div className="absolute top-6 right-32">
          <Link href="/admin">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-white border-white hover:bg-white hover:text-gray-800"
            >
              Admin Panel
            </Button>
          </Link>
        </div>
      )}

      {/* Main Card */}
      <div className="bg-slate-600 rounded-lg p-8 w-full max-w-md shadow-xl">
        <h1 className="text-white text-2xl font-bold text-center mb-8">
          Law Enforcement Form Selection
        </h1>

        <div className="flex flex-col gap-6">
          {/* Citation Form Button */}
          <Link href="/citation">
            <Button 
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-6 rounded-lg text-lg font-semibold flex items-center justify-center space-x-3 transition-colors border-0"
            >
              <FileText className="w-5 h-5" />
              <span>Citation Form</span>
            </Button>
          </Link>

          {/* Arrest Form Button */}
          <Link href="/arrest">
            <Button 
              className="w-full bg-red-600 hover:bg-red-700 text-white py-6 rounded-lg text-lg font-semibold flex items-center justify-center space-x-3 transition-colors border-0"
            >
              <UserX className="w-5 h-5" />
              <span>Arrest Form</span>
            </Button>
          </Link>

          {/* Shift Log Button */}
          <Link href="/shift-log">
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-lg text-lg font-semibold flex items-center justify-center space-x-3 transition-colors border-0"
            >
              <FileText className="w-5 h-5" />
              <span>Shift Log</span>
            </Button>
          </Link>

          {/* Admin Panel Button - Only visible to admins */}
          {user?.isAdmin === true && (
            <Link href="/admin">
              <Button 
                className="w-full bg-amber-600 hover:bg-amber-700 text-white py-6 rounded-lg text-lg font-semibold flex items-center justify-center space-x-3 transition-colors border-0"
              >
                <UserX className="w-5 h-5" />
                <span>Admin Panel</span>
              </Button>
            </Link>
          )}
          

        </div>

        <p className="text-gray-300 text-center mt-8 text-sm">
          Select the appropriate form type to proceed
        </p>
      </div>
    </div>
  );
}