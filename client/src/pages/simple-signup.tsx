import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

const signupSchema = z.object({
  username: z.string().min(1, "Username is required"),
  badgeNumber: z.string().min(1, "Badge number is required"),
  rank: z.string().min(1, "Rank is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignupFormData = z.infer<typeof signupSchema>;

export default function SimpleSignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [discordVerified, setDiscordVerified] = useState(false);
  const [discordUser, setDiscordUser] = useState<{ id: string; username: string; discriminator: string } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check for Discord verification status on component mount
  useEffect(() => {
    const checkDiscordVerification = async () => {
      try {
        const response = await apiRequest("GET", "/api/auth/discord/status");
        if (response.ok) {
          const data = await response.json();
          if (data.verified) {
            setDiscordVerified(true);
            setDiscordUser({
              id: data.user.id,
              username: data.user.username,
              discriminator: data.user.discriminator || '0000'
            });
          }
        }
      } catch (error) {
        console.error("Failed to check Discord verification:", error);
      }
    };
    
    checkDiscordVerification();
  }, []);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: "",
      badgeNumber: "",
      rank: "",
      password: "",
    },
  });

  // Auto-fill Discord username when verification is complete
  useEffect(() => {
    if (discordVerified && discordUser) {
      form.setValue("username", discordUser.username);
    }
  }, [discordVerified, discordUser, form]);

  const discordAuthMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/auth/discord/url");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to get Discord auth URL");
      }
      return response.json();
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error: any) => {
      toast({
        title: "Discord Authentication Failed",
        description: error.message || "Failed to start Discord authentication",
        variant: "destructive",
      });
    },
  });

  const discordDisconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/discord/disconnect");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to disconnect Discord");
      }
      return response.json();
    },
    onSuccess: () => {
      setDiscordVerified(false);
      setDiscordUser(null);
      toast({
        title: "Discord Disconnected",
        description: "Discord account has been disconnected successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Disconnect Failed",
        description: error.message || "Failed to disconnect Discord",
        variant: "destructive",
      });
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: SignupFormData) => {
      if (!discordVerified) {
        throw new Error("Discord verification required");
      }
      
      // Add the missing fields that the backend expects
      const signupData = {
        ...data,
        fullName: data.username, // Use username as full name
        department: "Police Department", // Default department
        email: `${data.username}@police.dept`, // Generate email
        phoneNumber: "555-0000", // Default phone number
      };
      
      const response = await apiRequest("POST", "/api/auth/signup", signupData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Signup failed");
      }
      return response.json();
    },
    onSuccess: async (data) => {
      // Invalidate auth query to force refresh with new authenticated state
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      
      toast({
        title: "Account Created Successfully!",
        description: `Welcome to the law enforcement database, ${data.user.username}!`,
      });
      
      // Redirect to selection page after successful signup
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    },
    onError: (error: any) => {
      toast({
        title: "Account Creation Failed",
        description: error.message || "Please check your Discord username and try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SignupFormData) => {
    signupMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--law-primary)" }}>
      <Card className="w-full max-w-md law-card shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold text-white">Create Account</CardTitle>
          <CardDescription className="text-gray-300">
            Join the law enforcement database system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Username</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="text"
                        placeholder="Your username"
                        className="law-input"
                        disabled={signupMutation.isPending || discordVerified}
                        readOnly={discordVerified}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="badgeNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Badge Number</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        placeholder="Enter your badge number"
                        className="law-input"
                        disabled={signupMutation.isPending}
                        onKeyPress={(e) => {
                          // Only allow numbers
                          if (!/[0-9]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'Tab' && e.key !== 'Enter') {
                            e.preventDefault();
                          }
                        }}
                        onChange={(e) => {
                          // Only allow numbers
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rank"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Rank</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="text"
                        placeholder="Your rank (e.g., Officer, Sergeant)"
                        className="law-input"
                        disabled={signupMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Password</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a password"
                        className="law-input"
                        disabled={signupMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="showPassword"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="showPassword" className="text-sm text-gray-300">
                  Show password
                </label>
              </div>

              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-white text-sm mb-3">Discord Verification Required</p>
                  {!discordVerified ? (
                    <Button 
                      type="button"
                      onClick={() => discordAuthMutation.mutate()}
                      disabled={discordAuthMutation.isPending}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {discordAuthMutation.isPending ? "Redirecting..." : "🔗 Verify with Discord"}
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-green-800 border border-green-600 rounded-md p-3">
                        <p className="text-green-200 text-sm">
                          ✅ Discord Verified: {discordUser?.username}#{discordUser?.discriminator}
                        </p>
                      </div>
                      <Button 
                        type="button"
                        onClick={() => discordDisconnectMutation.mutate()}
                        disabled={discordDisconnectMutation.isPending}
                        className="w-full bg-red-600 hover:bg-red-700 text-white text-sm py-2"
                      >
                        {discordDisconnectMutation.isPending ? "Disconnecting..." : "Disconnect Discord"}
                      </Button>
                    </div>
                  )}
                  <p className="text-gray-400 text-xs mt-2">
                    You must be logged into Discord and be a member of the required server.
                  </p>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full law-accent-btn text-white"
                disabled={signupMutation.isPending || !discordVerified}
              >
                {signupMutation.isPending ? "Creating Account..." : !discordVerified ? "Discord Verification Required" : "Create Account"}
              </Button>

              <div className="text-center">
                <p className="text-gray-300 text-sm">
                  Already have an account?{" "}
                  <Link href="/login" className="text-purple-400 hover:text-purple-300 underline">
                    Sign In
                  </Link>
                </p>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}