
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
        const verified = urlParams.get('verified');
        const error = urlParams.get('error');

        console.log("Discord callback URL:", window.location.href);
        console.log("Verified:", verified, "Error:", error);

        if (error) {
          let errorMessage = "Discord authentication failed";
          
          switch (error) {
            case 'insufficient_role':
              errorMessage = "You don't have the required 'LEO' role in the Discord server. Please contact an admin to get the proper role.";
              break;
            case 'not_member':
              errorMessage = "You are not a member of the required Discord server. Please join the server and try again.";
              break;
            case 'auth_failed':
              errorMessage = "Discord authentication failed. Please try again.";
              break;
            case 'discord_failed':
              errorMessage = "Discord authentication failed. Please try again.";
              break;
            default:
              errorMessage = "Discord verification failed: " + error;
          }
          
          throw new Error(errorMessage);
        }

        setStatus("Checking verification status...");

        // Check the verification status from the server
        const statusResponse = await fetch("/api/auth/discord/status", {
          credentials: "include",
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          if (statusData.verified) {
            toast({
              title: "Discord Verified!",
              description: `Successfully verified as ${statusData.user.username}`,
            });

            // Store verification status in localStorage for the signup page
            localStorage.setItem('discordVerified', JSON.stringify({
              verified: true,
              user: statusData.user,
              timestamp: Date.now()
            }));

            // Redirect back to signup
            setLocation("/signup");
            return;
          }
        }

        throw new Error("Discord verification not found in session");

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
