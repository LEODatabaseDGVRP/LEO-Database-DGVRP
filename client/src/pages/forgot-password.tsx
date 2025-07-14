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
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

const forgotPasswordSchema = z.object({
  discordUsername: z.string().min(1, "Discord username is required"),
});

const resetPasswordSchema = z.object({
  resetCode: z.string().min(32, "Reset code is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordData = z.infer<typeof resetPasswordSchema>;

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"request" | "reset">("request");
  const [resetToken, setResetToken] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCodeValue, setVerificationCodeValue] = useState("");
  const { toast } = useToast();

  const forgotForm = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      discordUsername: "",
    },
  });

  const resetForm = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      resetCode: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const requestResetMutation = useMutation({
    mutationFn: async (data: ForgotPasswordData) => {
      const response = await apiRequest("POST", "/api/auth/forgot-password", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send reset code");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Reset Code Sent",
        description: "A password reset code has been sent to your Discord DM. Check your Discord messages.",
      });
      setResetToken(data.resetToken);
      setStep("reset");
    },
    onError: (error: any) => {
      toast({
        title: "Reset Request Failed",
        description: error.message || "Failed to send reset code. Make sure you're a member of the Discord server.",
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordData) => {
      const response = await apiRequest("POST", "/api/auth/reset-password", {
        resetToken,
        resetCode: data.resetCode,
        newPassword: data.newPassword,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to reset password");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password Reset Successful",
        description: "Your password has been reset successfully. You can now log in with your new password.",
      });
      setTimeout(() => {
        window.location.replace("/login");
      }, 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Password Reset Failed",
        description: error.message || "Failed to reset password. Please check your reset code and try again.",
        variant: "destructive",
      });
    },
  });

  const onForgotSubmit = (data: ForgotPasswordData) => {
    requestResetMutation.mutate(data);
  };

  const onResetSubmit = (data: ResetPasswordData) => {
    resetPasswordMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--law-primary)" }}>
      <Card className="w-full max-w-md law-card shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold text-white">
            {step === "request" ? "Forgot Password" : "Reset Password"}
          </CardTitle>
          <CardDescription className="text-gray-300">
            {step === "request" 
              ? "Enter your Discord username or Discord ID to receive a reset code"
              : "Copy and paste the verification code from your Discord DM"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "request" ? (
            <Form {...forgotForm}>
              <form onSubmit={forgotForm.handleSubmit(onForgotSubmit)} className="space-y-4">
                <FormField
                  control={forgotForm.control}
                  name="discordUsername"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Discord Username or ID</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="text"
                          placeholder="Your Discord username or Discord ID"
                          className="law-input"
                          disabled={requestResetMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full law-accent-btn text-white"
                  disabled={requestResetMutation.isPending}
                >
                  {requestResetMutation.isPending ? "Sending Reset Code..." : "Send Reset Code"}
                </Button>

                <div className="text-center space-y-2">
                  <p className="text-gray-300 text-sm">
                    Remember your password?{" "}
                    <Link href="/login" className="text-purple-400 hover:text-purple-300 underline">
                      Back to Login
                    </Link>
                  </p>
                </div>
              </form>
            </Form>
          ) : (
            <Form {...resetForm}>
              <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-white text-sm font-medium">Verification Code</label>
                  <div className="relative">
                    <div 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 law-input cursor-text"
                      onClick={() => {
                        const hiddenInput = document.getElementById('hidden-verification-input') as HTMLInputElement;
                        if (hiddenInput) {
                          hiddenInput.focus();
                        }
                      }}
                    >
                      {verificationCodeValue || "Paste the long verification code from Discord DM"}
                    </div>
                    <input
                      id="hidden-verification-input"
                      type="text"
                      value={verificationCodeValue}
                      onChange={(e) => {
                        const value = e.target.value;
                        setVerificationCodeValue(value);
                        resetForm.setValue('resetCode', value);
                      }}
                      className="absolute inset-0 opacity-0 cursor-text"
                      disabled={resetPasswordMutation.isPending}
                      autoComplete="nope"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                      data-form-type="search"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      tabIndex={0}
                      aria-label="Verification code input"
                      onFocus={() => {
                        setTimeout(() => {
                          setVerificationCodeValue("");
                          resetForm.setValue('resetCode', "");
                        }, 5);
                      }}
                    />
                  </div>
                  {resetForm.formState.errors.resetCode && (
                    <p className="text-sm text-red-500">{resetForm.formState.errors.resetCode.message}</p>
                  )}
                </div>

                <FormField
                  control={resetForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">New Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter new password"
                          className="law-input"
                          disabled={resetPasswordMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={resetForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Confirm New Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type={showPassword ? "text" : "password"}
                          placeholder="Confirm new password"
                          className="law-input"
                          disabled={resetPasswordMutation.isPending}
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
                  disabled={resetPasswordMutation.isPending}
                >
                  {resetPasswordMutation.isPending ? "Resetting Password..." : "Reset Password"}
                </Button>

                <div className="text-center space-y-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("request")}
                    className="text-gray-300 hover:text-white"
                    disabled={resetPasswordMutation.isPending}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Request
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}