import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: number;
  username: string;
  isAdmin: boolean;
  badgeNumber: string;
  rpName: string | null;
  rank: string | null;
  discordId: string | null;
}

interface AuthResponse {
  user: User;
}

export function useAuth() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
        });
        
        if (response.status === 401) {
          return null; // Not authenticated
        }
        
        if (!response.ok) {
          throw new Error("Failed to check authentication");
        }
        
        const data: AuthResponse = await response.json();
        return data.user;
      } catch (error) {
        console.log("Auth check failed:", error);
        return null; // Not authenticated
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    user: data,
    isLoading,
    isAuthenticated: !!data,
    refetch,
    error
  };
}