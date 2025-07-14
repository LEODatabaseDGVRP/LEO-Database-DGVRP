import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ProductionMutationOptions {
  endpoint: string;
  method: "POST" | "PUT" | "DELETE";
  successMessage: string;
  errorMessage: string;
  onSuccess?: (data: any) => void;
  invalidateQueries?: string[];
}

export function useProductionMutation(options: ProductionMutationOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      console.log(`🚀 Production mutation starting for ${options.endpoint}`);
      console.log("🌐 Environment:", window.location.hostname);
      
      let attempt = 0;
      const maxAttempts = 3;
      
      while (attempt < maxAttempts) {
        try {
          attempt++;
          console.log(`📡 Attempt ${attempt}/${maxAttempts} for ${options.endpoint}`);
          
          const response = await apiRequest(options.method, options.endpoint, data);
          console.log(`📡 API Response status (attempt ${attempt}):`, response.status);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ API Error response (attempt ${attempt}):`, errorText);
            
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { message: errorText || `Failed to process ${options.endpoint}` };
            }
            
            // On last attempt, throw the error
            if (attempt === maxAttempts) {
              throw new Error(errorData.message || `Failed to process ${options.endpoint}`);
            }
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
          
          const result = await response.json();
          console.log(`✅ API Success response (attempt ${attempt}):`, result);
          return result;
          
        } catch (error) {
          console.error(`🔥 Mutation error (attempt ${attempt}):`, error);
          
          // If it's the last attempt, throw the error
          if (attempt === maxAttempts) {
            console.error("🔥 Error details:", {
              name: error.name,
              message: error.message,
              stack: error.stack
            });
            throw error;
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    },
    onMutate: (data) => {
      console.log(`🔄 Production mutation starting for ${options.endpoint}...`);
      toast({
        title: "Processing Request",
        description: "Your request is being processed...",
      });
    },
    onSuccess: (data) => {
      console.log(`✅ Production mutation successful for ${options.endpoint}:`, data);
      toast({
        title: "Success!",
        description: options.successMessage,
        duration: 5000,
      });
      
      // Invalidate queries
      if (options.invalidateQueries) {
        options.invalidateQueries.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey: [queryKey] });
        });
      }
      
      // Run custom success callback
      if (options.onSuccess) {
        options.onSuccess(data);
      }
    },
    onError: (error: any) => {
      console.error(`❌ Production mutation failed for ${options.endpoint}:`, error);
      toast({
        title: "Request Failed",
        description: error.message || options.errorMessage,
        variant: "destructive",
      });
    },
    retry: false, // We handle retry manually
  });
}