
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

const signupSchema = z.object({
  badgeNumber: z.string()
    .min(1, "Badge number is required")
    .max(10, "Badge number must be less than 10 characters")
    .regex(/^[0-9]+$/, "Badge number can only contain numbers"),
  rpName: z.string()
    .min(1, "RP name is required")
    .max(50, "RP name must be less than 50 characters"),
  rank: z.string()
    .min(1, "Rank is required")
    .max(30, "Rank must be less than 30 characters"),
  password: z.string()
    .min(6, "Password must be at least 6 characters")
    .max(50, "Password must be less than 50 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [discordVerified, setDiscordVerified] = useState(false);
  const [discordUser, setDiscordUser] = useState<{ id: string; username: string; discriminator: string } | null>(null);
  const { toast } = useToast();

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
      badgeNumber: "",
      rpName: "",
      rank: "",
      password: "",
      confirmPassword: "",
    },
  });

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
      if (!discordVerified || !discordUser) {
        throw new Error("Discord verification required");
      }
      
      const { confirmPassword, ...signupData } = data;
      // Use Discord username from verification as the username for account creation
      const finalData = { ...signupData, username: discordUser.username };
      const response = await apiRequest("POST", "/api/auth/signup", finalData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Account creation failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Account Created Successfully!",
        description: `Welcome, ${data.user.username}! You are now signed in.`,
      });
      // Redirect to home page (user is already logged in)
      window.location.href = "/";
    },
    onError: (error: any) => {
      let errorMessage = "Unable to create account. Please try again.";
      
      // Handle specific server error messages
      if (error.message) {
        if (error.message.includes("Username already exists")) {
          errorMessage = "This username is already taken. Please choose a different username.";
        } else if (error.message.includes("Username is not available")) {
          errorMessage = "This username is not available. Please choose a different username.";
        } else if (error.message.includes("Username is terminated")) {
          errorMessage = "This username cannot be used. Please choose a different username.";
        } else if (error.message.includes("Discord verification failed")) {
          errorMessage = "Discord verification failed. Please ensure you are in the server and have the required role.";
        } else if (error.message.includes("Invalid input data")) {
          errorMessage = "Please check your information and try again.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Account Creation Failed",
        description: errorMessage,
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
            Register for law enforcement portal access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="badgeNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Badge Number:</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="text"
                        placeholder="Ex: 1234"
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
                name="rpName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">RP Name:</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="text"
                        placeholder="Ex: P.Popfork1"
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
                name="rank"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Rank:</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="text"
                        placeholder="Ex: Sergeant"
                        className="law-input"
                        disabled={signupMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Password:</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a secure password"
                        className="law-input"
                        disabled={signupMutation.isPending}
                        autoComplete="new-password"
                        data-1p-ignore="true"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Confirm Password</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type={showPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        className="law-input"
                        disabled={signupMutation.isPending}
                        autoComplete="new-password"
                        data-1p-ignore="true"
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
                  Show passwords
                </label>
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
    </div>import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

const signupSchema = z.object({
  badgeNumber: z.string()
    .min(1, "Badge number is required")
    .max(10, "Badge number must be less than 10 characters")
    .regex(/^[0-9]+$/, "Badge number can only contain numbers"),
  rpName: z.string()
    .min(1, "RP name is required")
    .max(50, "RP name must be less than 50 characters"),
  rank: z.string()
    .min(1, "Rank is required")
    .max(30, "Rank must be less than 30 characters"),
  password: z.string()
    .min(6, "Password must be at least 6 characters")
    .max(50, "Password must be less than 50 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [discordVerified, setDiscordVerified] = useState(false);
  const [discordUser, setDiscordUser] = useState<{ id: string; username: string; discriminator: string } | null>(null);
  const { toast } = useToast();

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
      badgeNumber: "",
      rpName: "",
      rank: "",
      password: "",
      confirmPassword: "",
    },
  });

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
      if (!discordVerified || !discordUser) {
        throw new Error("Discord verification required");
      }
      
      const { confirmPassword, ...signupData } = data;
      const finalData = { ...signupData, username: discordUser.username }; // Use Discord username
      const response = await apiRequest("POST", "/api/auth/signup", finalData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Account creation failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Account Created Successfully!",
        description: `Welcome, ${data.user.username}! You are now signed in.`,
      });
      // Redirect to home page (user is already logged in)
      window.location.href = "/";
    },
    onError: (error: any) => {
      let errorMessage = "Unable to create account. Please try again.";
      if (error.message) {
        errorMessage = error.message; // Handle specific error messages as needed
      }
      toast({
        title: "Account Creation Failed",
        description: errorMessage,
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
            Register for law enforcement portal access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="badgeNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Badge Number:</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="text"
                        placeholder="Ex: 1234"
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
                name="rpName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">RP Name:</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="text"
                        placeholder="Ex: P.Popfork1"
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
                name="rank"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Rank:</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="text"
                        placeholder="Ex: Sergeant"
                        className="law-input"
                        disabled={signupMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Password:</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a secure password"
                        className="law-input"
                        disabled={signupMutation.isPending}
                        autoComplete="new-password"
                        data-1p-ignore="true"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Confirm Password:</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type={showPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        className="law-input"
                        disabled={signupMutation.isPending}
                        autoComplete="new-password"
                        data-1p-ignore="true"
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
                  Show passwords
                </label>
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
  );
}
