import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function SimpleLoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  // Check for error parameters in URL
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get('error');

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Login failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Login Successful!",
        description: `Welcome back, ${data.user.username}!`,
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    },
    onError: (error: any) => {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid username or password. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--law-primary)" }}>
      <Card className="w-full max-w-md law-card shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold text-white">Law Enforcement Database</CardTitle>
          <CardDescription className="text-gray-300">
            Sign in to access citation and arrest forms
          </CardDescription>

          {error && (
            <div className="mt-4 p-3 bg-red-600/20 border border-red-500 rounded-md">
              <p className="text-red-200 text-sm">
                {error === 'discord_auth_failed' && 'Discord authentication failed. Please try again.'}
                {error === 'expired_state' && 'Authentication session expired. Please try again.'}
                {error === 'invalid_state' && 'Invalid authentication request. Please try again.'}
                {error === 'discord_callback_failed' && 'Discord verification failed. Please try again.'}
                {error === 'session_save_failed' && 'Session error. Please try again.'}
                {!['discord_auth_failed', 'expired_state', 'invalid_state', 'discord_callback_failed', 'session_save_failed'].includes(error) && 'An error occurred. Please try again.'}
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                        placeholder="Enter your username"
                        className="law-input"
                        disabled={loginMutation.isPending}
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
                        placeholder="Enter your password"
                        className="law-input"
                        disabled={loginMutation.isPending}
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

              <Button 
                type="submit" 
                className="w-full law-accent-btn text-white"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Signing In..." : "Sign In"}
              </Button>



              <div className="text-center space-y-2">
                <p className="text-gray-300 text-sm">
                  <Link href="/forgot-password" className="text-purple-400 hover:text-purple-300 underline">
                    Forgot your password?
                  </Link>
                </p>
                <p className="text-gray-300 text-sm">
                  Don't have an account?{" "}
                  <Link href="/signup" className="text-purple-400 hover:text-purple-300 underline">
                    Create Account
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
