
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/hooks/useAuth";
import { useOfficerProfile } from "@/hooks/useOfficerProfile";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

const shiftLogSchema = z.object({
  callsign: z.string().min(1, "Callsign is required"),
  shiftDuration: z.string().min(1, "Shift duration is required"),
  trafficStops: z.string().min(1, "Number of traffic stops is required"),
  citations: z.string().min(1, "Number of citations is required"),
  arrests: z.string().min(1, "Number of arrests is required"),
  additionalNotes: z.string().optional(),
});

type ShiftLogData = z.infer<typeof shiftLogSchema>;

export default function ShiftLogPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { officerProfile } = useOfficerProfile();

  const form = useForm<ShiftLogData>({
    resolver: zodResolver(shiftLogSchema),
    defaultValues: {
      callsign: officerProfile?.callsign || "",
      shiftDuration: "",
      trafficStops: "",
      citations: "",
      arrests: "",
      additionalNotes: "",
    },
  });

  const submitShiftLogMutation = useMutation({
    mutationFn: async (data: ShiftLogData) => {
      const response = await fetch("/api/shift-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to submit shift log");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Shift log submitted successfully!",
      });
      form.reset();
    },
    onError: (error: any) => {
      console.error("Shift log submission error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit shift log. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ShiftLogData) => {
    submitShiftLogMutation.mutate(data);
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: "#2d3748" }}
    >
      <div className="bg-slate-600 rounded-lg p-8 w-full max-w-2xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/selection">
            <Button variant="outline" size="sm" className="text-white border-white hover:bg-white hover:text-gray-800">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-white text-2xl font-bold text-center flex-1">
            Shift Log Form
          </h1>
          <div className="w-16" /> {/* Spacer for centering */}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Username & Badge Number (Read-only) */}
            <div className="space-y-2">
              <label className="text-white font-semibold">Username & Badge Number:</label>
              <div className="bg-gray-700 rounded-lg px-4 py-2 text-white">
                {user?.fullName || user?.username} - Badge #{user?.badgeNumber}
              </div>
            </div>

            {/* Callsign */}
            <FormField
              control={form.control}
              name="callsign"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white font-semibold">Callsign:</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="law-input"
                      placeholder="Ex: Alpha-1, Bravo-2"
                      disabled={submitShiftLogMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Shift Duration */}
            <FormField
              control={form.control}
              name="shiftDuration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white font-semibold">Shift Duration:</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="law-input"
                      placeholder="Ex: 3 hours, 45 minutes"
                      disabled={submitShiftLogMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Rank (Read-only) */}
            <div className="space-y-2">
              <label className="text-white font-semibold">Rank:</label>
              <div className="bg-gray-700 rounded-lg px-4 py-2 text-white">
                {user?.rank}
              </div>
            </div>

            {/* Traffic Stops */}
            <FormField
              control={form.control}
              name="trafficStops"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white font-semibold">Traffic Stops:</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="law-input"
                      placeholder="Number of traffic stops"
                      disabled={submitShiftLogMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Citations */}
            <FormField
              control={form.control}
              name="citations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white font-semibold">Citations:</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="law-input"
                      placeholder="Number of citations issued"
                      disabled={submitShiftLogMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Arrests */}
            <FormField
              control={form.control}
              name="arrests"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white font-semibold">Arrests:</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="law-input"
                      placeholder="Number of arrests made"
                      disabled={submitShiftLogMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Additional Notes */}
            <FormField
              control={form.control}
              name="additionalNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white font-semibold">Additional Notes:</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      className="law-input min-h-[100px]"
                      placeholder="Any additional information about your shift..."
                      disabled={submitShiftLogMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit Button */}
            <Button 
              type="submit" 
              disabled={submitShiftLogMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg text-lg font-semibold transition-colors"
            >
              {submitShiftLogMutation.isPending ? "Submitting..." : "Submit Shift Log"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
