
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function DiscordCallbackPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [status, setStatus] = useState("Processing...");

  useEffect(() => {
    const handleDiscordCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        console.log("Discord callback URL:", window.location.href);
        console.log("Code:", code, "State:", state, "Error:", error);

        if (error) {
          throw new Error(`Discord authentication failed: ${error}`);
        }

        if (!code || !state) {
          throw new Error("Missing required parameters from Discord");
        }

        setStatus("Verifying with server...");

        // Send the code and state to our server's callback endpoint
        const response = await fetch("/api/auth/discord/callback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code, state }),
          credentials: "include", // Important for session cookies
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Discord verification failed");
        }

        const data = await response.json();

        toast({
          title: "Discord Verified!",
          description: `Successfully verified as ${data.user.username}#${data.user.discriminator}`,
        });

        // Store verification status in localStorage for the signup page
        localStorage.setItem('discordVerified', JSON.stringify({
          verified: true,
          user: data.user,
          timestamp: Date.now()
        }));

        // Redirect back to signup
        setLocation("/signup");

      } catch (error: any) {
        console.error("Discord callback error:", error);
        setStatus("Verification failed");
        
        toast({
          title: "Discord Verification Failed",
          description: error.message || "Failed to verify Discord account",
          variant: "destructive",
        });

        setTimeout(() => {
          setLocation("/signup");
        }, 3000);
      }
    };

    handleDiscordCallback();
  }, [setLocation, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--law-primary)" }}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-white text-lg">{status}</p>
        <p className="text-gray-300 text-sm mt-2">
          Please wait while we verify your Discord account...
        </p>
      </div>
    </div>
  );
}
