import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useOfficerProfile } from "@/hooks/useOfficerProfile";
import { apiRequest } from "@/lib/queryClient";
import { insertCitationSchema } from "@shared/schema";
import { Trash2, Plus, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const formSchema = insertCitationSchema.extend({
  penalCodes: z.array(z.string().min(1, "Penal code is required")).min(1, "At least one penal code is required"),
  amountsDue: z.array(z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount format")).min(1, "At least one amount is required"),
});

type FormData = z.infer<typeof formSchema>;

interface PenalCodeField {
  id: string;
  penalCode: string;
  amountDue: string;
}

interface OfficerField {
  id: string;
  badge: string;
  username: string;
  rank: string;
  userId: string;
}

interface PenalCodeOption {
  code: string;
  description: string;
  amount: string;
  jailTime: string;
}

interface ViolationCategory {
  name: string;
  codes: string[];
}

const VIOLATION_CATEGORIES: ViolationCategory[] = [
  { name: "Criminal Threats & Assault", codes: ["(1)01", "(1)02", "(1)03"] },
  { name: "Battery & Violence", codes: ["(1)04", "(1)05", "(1)11", "(1)12"] },
  { name: "Murder & Manslaughter", codes: ["(1)06", "(1)07", "(1)08"] },
  { name: "Imprisonment & Kidnapping", codes: ["(1)09", "(1)10"] },
  { name: "Assault on Officers", codes: ["(1)13", "(1)14", "(1)15", "(4)15"] },
  { name: "Property Crimes", codes: ["(2)01", "(2)04", "(2)06", "(2)07", "(2)09", "(2)10"] },
  { name: "Theft & Burglary", codes: ["(2)05", "(2)08", "(2)11", "(2)12", "(2)13"] },
  { name: "Trespassing", codes: ["(2)02", "(2)03"] },
  { name: "Property Damage", codes: ["(2)14", "(2)16", "(2)17"] },
  { name: "Public Order", codes: ["(2)15", "(3)01", "(3)02", "(3)03", "(3)04"] },
  { name: "Government Interference", codes: ["(4)01", "(4)02", "(4)03", "(4)04"] },
  { name: "Officer Obstruction", codes: ["(4)05", "(4)06", "(4)07", "(4)08"] },
  { name: "Custody & Justice", codes: ["(4)09", "(4)10", "(4)13", "(4)14", "(4)16"] },
  { name: "Evidence & Compliance", codes: ["(4)11", "(4)12", "(4)17", "(4)18", "(4)19"] },
  { name: "Public Disturbance", codes: ["(5)01", "(5)02", "(5)03"] },
  { name: "Drug Offenses", codes: ["(6)04", "(6)05", "(6)06", "(6)08", "(6)09"] },
  { name: "Animal & Child Safety", codes: ["(7)01", "(7)04"] },
  { name: "Licensing & Registration", codes: ["(8)01", "(8)02", "(8)03"] },
  { name: "Accident Requirements", codes: ["(8)04", "(8)05"] },
  { name: "Traffic Signals & Signs", codes: ["(8)06", "(8)20"] },
  { name: "Lane & Direction", codes: ["(8)07", "(8)08", "(8)12", "(8)13", "(8)14"] },
  { name: "Yielding & Following", codes: ["(8)09", "(8)10", "(8)11", "(8)39"] },
  { name: "Speeding", codes: ["(8)15", "(8)16", "(8)17", "(8)18", "(8)32"] },
  { name: "Parking & Stopping", codes: ["(8)19", "(8)21", "(8)53"] },
  { name: "Reckless Driving", codes: ["(8)22", "(8)23", "(8)24", "(8)49"] },
  { name: "DUI & Impairment", codes: ["(8)25", "(8)40"] },
  { name: "Evasion & Road Rage", codes: ["(8)26", "(8)29", "(8)30", "(8)47"] },
  { name: "Traffic Equipment", codes: ["(8)36", "(8)37", "(8)43", "(8)54", "(8)55"] },
  { name: "Vehicle Condition", codes: ["(8)50", "(8)52"] },
  { name: "Driving Behavior", codes: ["(8)31", "(8)33", "(8)34", "(8)35", "(8)41", "(8)42", "(8)51"] },
  { name: "Citation & Accidents", codes: ["(8)38", "(8)44"] },
  { name: "Vehicular Crimes", codes: ["(8)45", "(8)46", "(8)48"] },
  { name: "Weapons", codes: ["(9)01", "(9)02", "(9)03", "(9)04", "(9)05", "(9)06"] },
];

const PENAL_CODE_OPTIONS: PenalCodeOption[] = [
  // Section 2 - Property Crimes
  { code: "(2)08", description: "Petty Theft", amount: "1000.00", jailTime: "None" },
  { code: "(2)15", description: "Loitering", amount: "1000.00", jailTime: "None" },

  // Section 4 - Government/Law Enforcement
  { code: "(4)11", description: "Misuse of Government Hotline", amount: "1000.00", jailTime: "None" },
  { code: "(4)12", description: "Tampering with Evidence", amount: "1000.00", jailTime: "None" },

  // Section 5 - Public Disturbance
  { code: "(5)01", description: "Disturbing the Peace", amount: "500.00", jailTime: "None" },

  // Section 8 - Traffic Violations
  { code: "(8)01", description: "Invalid / No Vehicle Registration / Insurance", amount: "200.00", jailTime: "None" },
  { code: "(8)02", description: "Driving Without a License", amount: "1000.00", jailTime: "None" },
  { code: "(8)04", description: "Accident Reporting Requirements - Property Damage", amount: "1000.00", jailTime: "None" },
  { code: "(8)06", description: "Failure to Obey Traffic Signal", amount: "250.00", jailTime: "None" },
  { code: "(8)07", description: "Driving Opposite Direction", amount: "500.00", jailTime: "None" },
  { code: "(8)08", description: "Failure to Maintain Lane", amount: "250.00", jailTime: "None" },
  { code: "(8)09", description: "Unsafe Following Distance", amount: "250.00", jailTime: "None" },
  { code: "(8)10", description: "Failure to Yield to Civilian", amount: "250.00", jailTime: "None" },
  { code: "(8)11", description: "Failure to Yield to Emergency Vehicles", amount: "250.00", jailTime: "None" },
  { code: "(8)12", description: "Unsafe Turn", amount: "250.00", jailTime: "None" },
  { code: "(8)13", description: "Unsafe Lane Change", amount: "250.00", jailTime: "None" },
  { code: "(8)14", description: "Illegal U-Turn", amount: "250.00", jailTime: "None" },
  { code: "(8)15", description: "Speeding (6-15 MPH Over)", amount: "250.00", jailTime: "None" },
  { code: "(8)16", description: "Speeding (16-25 MPH Over)", amount: "360.00", jailTime: "None" },
  { code: "(8)17", description: "Speeding (26+ MPH Over)", amount: "500.00", jailTime: "None" },
  { code: "(8)19", description: "Unreasonably Slow / Stopped", amount: "250.00", jailTime: "None" },
  { code: "(8)20", description: "Failure to Obey Stop Sign / RED LIGHT", amount: "250.00", jailTime: "None" },
  { code: "(8)21", description: "Illegally Parked", amount: "250.00", jailTime: "None" },
  { code: "(8)24", description: "Throwing Objects", amount: "1000.00", jailTime: "None" },
  { code: "(8)31", description: "Littering", amount: "1000.00", jailTime: "None" },
  { code: "(8)32", description: "Unsafe Speed for Conditions", amount: "2000.00", jailTime: "None" },
  { code: "(8)33", description: "Hogging Passing Lane", amount: "250.00", jailTime: "None" },
  { code: "(8)34", description: "Impeding Traffic", amount: "250.00", jailTime: "None" },
  { code: "(8)35", description: "Jaywalking", amount: "250.00", jailTime: "None" },
  { code: "(8)36", description: "Unnecessary Use of Horn", amount: "400.00", jailTime: "None" },
  { code: "(8)37", description: "Excessive Music / Engine Sounds", amount: "400.00", jailTime: "None" },
  { code: "(8)39", description: "Failure to Yield to Pedestrian", amount: "250.00", jailTime: "None" },
  { code: "(8)40", description: "Distracted Driving", amount: "1000.00", jailTime: "None" },
  { code: "(8)41", description: "Driving on Shoulder / Emergency Lane", amount: "250.00", jailTime: "None" },
  { code: "(8)42", description: "Move Over Law", amount: "1000.00", jailTime: "None" },
  { code: "(8)43", description: "Driving Without Headlights", amount: "250.00", jailTime: "None" },
  { code: "(8)44", description: "Hit and Run", amount: "500.00", jailTime: "None" },
  { code: "(8)50", description: "Unroadworthy Vehicle", amount: "1000.00", jailTime: "None" },
  { code: "(8)51", description: "Drifting on a Public Road", amount: "250.00", jailTime: "None" },
  { code: "(8)52", description: "Failure to Control Vehicle", amount: "250.00", jailTime: "None" },
  { code: "(8)53", description: "Unsafe Parking (Parking Ticket)", amount: "100.00", jailTime: "None" },
  { code: "(8)54", description: "Failure to Use Turn Signal", amount: "100.00", jailTime: "None" },
  { code: "(8)55", description: "Failure to Display License Plate (W/ only)", amount: "300.00", jailTime: "None" },
];

export default function CitationForm() {
  const { primaryOfficerData, savedOfficerList, saveOfficerList, autoSaveProfile } = useOfficerProfile();

  const [penalCodeFields, setPenalCodeFields] = useState<PenalCodeField[]>([
    { id: "1", penalCode: "", amountDue: ""}
  ]);
  const [officerFields, setOfficerFields] = useState<OfficerField[]>([
    { id: "1", badge: "", username: "", rank: "", userId: "" }
  ]);
  const [openComboboxes, setOpenComboboxes] = useState<{ [key: string]: boolean }>({});
  const [showClearDialog, setShowClearDialog] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      officerBadges: [""],
      officerUsernames: [""],
      officerRanks: [""],
      officerUserIds: [""],
      violatorUsername: "",
      violatorSignature: "",
      violationType: "Citation",
      penalCodes: [""],
      amountsDue: [""],
      totalAmount: "0.00",
      additionalNotes: "",
    },
  });

  // Initialize officer fields with saved data or primary officer data
  useEffect(() => {
    if (savedOfficerList.length > 0) {
      // Load saved officer list (for ride-alongs)
      setOfficerFields(savedOfficerList);
      const badges = savedOfficerList.map(officer => officer.badge);
      const usernames = savedOfficerList.map(officer => officer.username);
      const ranks = savedOfficerList.map(officer => officer.rank);
      const userIds = savedOfficerList.map(officer => officer.userId);

      form.setValue('officerBadges', badges);
      form.setValue('officerUsernames', usernames);
      form.setValue('officerRanks', ranks);
      form.setValue('officerUserIds', userIds);
    } else {
      // Auto-populate primary officer with user profile data
      const primaryOfficer = primaryOfficerData;
      
      // Only use meaningful values (more than 1 character) for RP name
      const filteredPrimaryOfficer = {
        ...primaryOfficer,
        username: primaryOfficer.username && primaryOfficer.username.length > 1 ? primaryOfficer.username : ""
      };
      
      if (filteredPrimaryOfficer.badge || filteredPrimaryOfficer.username || filteredPrimaryOfficer.rank || filteredPrimaryOfficer.userId) {
        setOfficerFields([{ id: "1", ...filteredPrimaryOfficer }]);
        form.setValue('officerBadges', [filteredPrimaryOfficer.badge]);
        form.setValue('officerUsernames', [filteredPrimaryOfficer.username]);
        form.setValue('officerRanks', [filteredPrimaryOfficer.rank]);
        form.setValue('officerUserIds', [filteredPrimaryOfficer.userId]);
      }
    }
  }, []);

  // Save officer data only on form submission to prevent infinite loops

  const submitMutation = useMutation({
    mutationFn: async (data: FormData) => {
      console.log("🚀 Mutation starting with data:", data);

      try {
        const response = await apiRequest("POST", "/api/citations", data);
        console.log("📡 API Response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("❌ API Error response:", errorText);
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { message: errorText || "Failed to submit citation" };
          }
          throw new Error(errorData.message || "Failed to submit citation");
        }

        const result = await response.json();
        console.log("✅ API Success response:", result);
        return result;
      } catch (error) {
        console.error("🔥 Mutation error:", error);
        throw error;
      }
    },
    onMutate: (data) => {
      console.log("🔄 Mutation starting...", data);
      toast({
        title: "🔄 Submitting Citation",
        description: "Processing your citation submission...",
      });
    },
    onSuccess: (data) => {
      console.log("✅ Mutation successful:", data);
      toast({
        title: "✅ Citation Submitted Successfully!",
        description: "The citation has been processed and sent to Discord.",
        duration: 5000, // Auto-dismiss after 5 seconds
      });
      // Clear form after successful submission but keep officer info
      setTimeout(() => {
        autoClearFormKeepOfficers();
      }, 1000);
    },
    onError: (error: any) => {
      console.error("❌ Mutation error:", error);
      toast({
        title: "❌ Submission Failed",
        description: error.message || "Failed to submit citation. Please check your connection and try again.",
        variant: "destructive",
      });
    },
  });

  const calculateTotal = () => {
    const amounts = form.getValues("amountsDue");
    const total = amounts.reduce((sum, amount) => {
      const num = parseFloat(amount) || 0;
      return sum + num;
    }, 0);
    form.setValue("totalAmount", total.toFixed(2));
    return total.toFixed(2);
  };





  const handlePenalCodeSelect = (selectedCode: string, index: number) => {
    const option = PENAL_CODE_OPTIONS.find(opt => opt.code === selectedCode);
    if (option) {
      const updatedFields = penalCodeFields.map((field, i) => 
        i === index 
          ? { ...field, penalCode: option.code, amountDue: option.amount }
          : field
      );
      setPenalCodeFields(updatedFields);

      const currentPenalCodes = form.getValues("penalCodes");
      const currentAmounts = form.getValues("amountsDue");

      currentPenalCodes[index] = selectedCode;
      currentAmounts[index] = option.amount;

      form.setValue("penalCodes", currentPenalCodes);
      form.setValue("amountsDue", currentAmounts);

      setTimeout(() => {
        calculateTotal();
      }, 0);
    }

    setOpenComboboxes(prev => ({ ...prev, [index]: false }));
  };

  const addPenalCodeField = () => {
    const newId = (penalCodeFields.length + 1).toString();
    setPenalCodeFields([...penalCodeFields, { id: newId, penalCode: "", amountDue: ""}]);

    const currentPenalCodes = form.getValues("penalCodes");
    const currentAmounts = form.getValues("amountsDue");
    form.setValue("penalCodes", [...currentPenalCodes, ""]);
    form.setValue("amountsDue", [...currentAmounts, ""]);
  };

  const removePenalCodeField = (index: number) => {
    if (penalCodeFields.length > 1) {
      const newFields = penalCodeFields.filter((_, i) => i !== index);
      setPenalCodeFields(newFields);

      const currentPenalCodes = form.getValues("penalCodes");
      const currentAmounts = form.getValues("amountsDue");
      form.setValue("penalCodes", currentPenalCodes.filter((_, i) => i !== index));
      form.setValue("amountsDue", currentAmounts.filter((_, i) => i !== index));
      calculateTotal();
    }
  };

  // Handle officer field changes with debouncing
  const updateOfficerField = useCallback((index: number, field: keyof OfficerField, value: string) => {
    setOfficerFields(prev => {
      const updatedFields = [...prev];
      updatedFields[index] = { ...updatedFields[index], [field]: value };
      return updatedFields;
    });
  }, []);

  const addOfficerField = () => {
    if (officerFields.length < 3) {
      const newId = (officerFields.length + 1).toString();
      const updatedFields = [...officerFields, { id: newId, badge: "", username: "", rank: "", userId: "" }];
      setOfficerFields(updatedFields);

      const badges = updatedFields.map(o => o.badge);
      const usernames = updatedFields.map(o => o.username);
      const ranks = updatedFields.map(o => o.rank);
      const userIds = updatedFields.map(o => o.userId);

      form.setValue("officerBadges", badges);
      form.setValue("officerUsernames", usernames);
      form.setValue("officerRanks", ranks);
      form.setValue("officerUserIds", userIds);
    } else {
      toast({
        title: "Maximum Officers Reached",
        description: "Citations are limited to 3 officers maximum (primary officer + 2 assisting officers).",
        variant: "destructive",
      });
    }
  };

  const removeOfficerField = (index: number) => {
    if (officerFields.length > 1) {
      const updatedFields = officerFields.filter((_, i) => i !== index);
      setOfficerFields(updatedFields);

      const badges = updatedFields.map(o => o.badge);
      const usernames = updatedFields.map(o => o.username);
      const ranks = updatedFields.map(o => o.rank);
      const userIds = updatedFields.map(o => o.userId);

      form.setValue("officerBadges", badges);
      form.setValue("officerUsernames", usernames);
      form.setValue("officerRanks", ranks);
      form.setValue("officerUserIds", userIds);
    }
  };

  const handleClearForm = () => {
    setShowClearDialog(true);
  };

  const confirmClearForm = () => {
    form.reset();
    setPenalCodeFields([{ id: "1", penalCode: "", amountDue: ""}]);
    setOfficerFields([{ id: "1", badge: "", username: "", rank: "", userId: "" }]);
    setShowClearDialog(false);
  };

  const autoClearFormKeepOfficers = () => {
    // Save current officer information
    const currentOfficerBadges = form.getValues("officerBadges");
    const currentOfficerUsernames = form.getValues("officerUsernames");
    const currentOfficerRanks = form.getValues("officerRanks");
    const currentOfficerUserIds = form.getValues("officerUserIds");

    // Save current officer fields state
    const currentOfficerFields = [...officerFields];

    // Reset only non-officer fields without calling form.reset()
    setPenalCodeFields([{ id: "1", penalCode: "", amountDue: ""}]);
    form.setValue("penalCodes", [""]);
    form.setValue("amountsDue", [""]);
    form.setValue("jailTimes", ["None"]);
    form.setValue("totalAmount", "0.00");
    form.setValue("totalJailTime", "0 Seconds");
    form.setValue("violatorUsername", "");
    form.setValue("violatorSignature", "");
    form.setValue("violationType", "");
    form.setValue("additionalNotes", "");

    // Ensure officer information is preserved
    form.setValue("officerBadges", currentOfficerBadges);
    form.setValue("officerUsernames", currentOfficerUsernames);
    form.setValue("officerRanks", currentOfficerRanks);
    form.setValue("officerUserIds", currentOfficerUserIds);

    // Preserve officer fields state
    setOfficerFields(currentOfficerFields);
  };

  const [showBackDialog, setShowBackDialog] = useState(false);

  const handleBackToSelection = () => {
    setShowBackDialog(true);
  };

  const confirmBackToHome = () => {
    setShowBackDialog(false);
    window.location.href = "/";
  };

  const onSubmit = (data: FormData) => {
    console.log("🎯 Form submitted with data:", data);

    // Save officer information before submitting
    const validOfficers = officerFields.filter(field => 
      field.badge.trim() && field.username.trim() && field.rank.trim() && field.userId.trim()
    );

    console.log("🔍 Officer fields validation:", {
      officerFields,
      validOfficers,
      validOfficersCount: validOfficers.length
    });

    if (validOfficers.length > 0) {
      saveOfficerList(validOfficers);

      // Also update primary officer profile if first officer has all data
      if (validOfficers[0]) {
        console.log("🚀 Calling autoSaveProfile with:", validOfficers[0]);
        autoSaveProfile(validOfficers[0]);
      }
    } else {
      console.log("❌ No valid officers found, skipping profile save");
    }

    // Validate required fields before processing
    if (!data.violatorUsername || data.violatorUsername.trim() === "") {
      toast({
        title: "❌ Validation Error",
        description: "Violator's Discord ID is required.",
        variant: "destructive",
      });
      return;
    }

    if (!data.violatorSignature || data.violatorSignature.trim() === "") {
      toast({
        title: "❌ Validation Error", 
        description: "Violator signature is required.",
        variant: "destructive",
      });
      return;
    }

    // Validate that we have at least one officer
    const validOfficerBadges = data.officerBadges.filter(badge => badge && badge.trim() !== "");
    const validOfficerUsernames = data.officerUsernames.filter(username => username && username.trim() !== "");
    const validOfficerRanks = data.officerRanks.filter(rank => rank && rank.trim() !== "");

    if (validOfficerBadges.length === 0) {
      toast({
        title: "❌ Validation Error",
        description: "At least one officer badge is required.",
        variant: "destructive",
      });
      return;
    }

    // Validate that we have at least one penal code
    const validPenalCodes = data.penalCodes.filter(code => code && code.trim() !== "");
    const validAmountsDue = data.amountsDue.filter(amount => amount && amount.trim() !== "");

    if (validPenalCodes.length === 0) {
      toast({
        title: "❌ Validation Error",
        description: "At least one penal code is required.",
        variant: "destructive",
      });
      return;
    }

    // Process and clean data
    const processedData = {
      ...data,
      officerBadges: validOfficerBadges,
      officerUsernames: validOfficerUsernames,
      officerRanks: validOfficerRanks,
      penalCodes: validPenalCodes,
      amountsDue: validAmountsDue,
      jailTimes: validPenalCodes.map(() => "None"),
      totalJailTime: "0 Seconds",
      violatorUsername: data.violatorUsername.trim(),
      violatorSignature: data.violatorSignature.trim(),
      additionalNotes: data.additionalNotes || "",
    };

    console.log("🚀 Processed citation data for submission:", processedData);

    // Submit the mutation
    submitMutation.mutate(processedData);
  };

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: "var(--law-primary)" }}>
      <div className="max-w-4xl mx-auto">
        <Card className="law-card shadow-2xl">
          <CardContent className="p-8">
            <h1 className="text-white text-2xl font-semibold text-center mb-8">Citation Form</h1>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Officer Information Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white text-lg font-semibold">Officer Information:</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addOfficerField}
                      className="law-accent-btn text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Officer ({officerFields.length}/3)
                    </Button>
                  </div>

                  {officerFields.map((field, index) => (
                    <div key={`officer-${field.id}-${index}`} className="space-y-4 mb-6 p-4 rounded-lg border border-slate-600 bg-slate-800/50">
                      <div className="flex items-center justify-between">
                        <h4 className="text-white font-medium">Officer #{index + 1}</h4>
                        {officerFields.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeOfficerField(index)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-600/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <FormField
                          control={form.control}
                          name={`officerBadges.${index}`}
                          render={({ field: formField }) => (
                            <FormItem>
                              <FormLabel className="text-white font-medium">Badge #:</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="N/A"
                                  className="law-input text-white placeholder:text-slate-400"
                                  {...formField}
                                  onKeyPress={(e) => {
                                    // Only allow numbers
                                    if (!/[0-9]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'Tab' && e.key !== 'Enter') {
                                      e.preventDefault();
                                    }
                                  }}
                                  onChange={(e) => {
                                    // Only allow numbers
                                    const value = e.target.value.replace(/[^0-9]/g, '');
                                    formField.onChange(value);
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`officerUsernames.${index}`}
                          render={({ field: formField }) => (
                            <FormItem>
                              <FormLabel className="text-white font-medium">RP Name:</FormLabel>
                              <FormControl>
                                <Input
                                  className="law-input text-white"
                                  placeholder="Ex: P.Popfork1"
                                  {...formField}
                                  onChange={(e) => {
                                    formField.onChange(e.target.value);
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`officerRanks.${index}`}
                          render={({ field: formField }) => (
                            <FormItem>
                              <FormLabel className="text-white font-medium">Rank:</FormLabel>
                              <FormControl>
                                <Input
                                  className="law-input text-white"
                                  placeholder="Ex: Sergeant"
                                  {...formField}
                                  onChange={(e) => {
                                    formField.onChange(e.target.value);
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`officerUserIds.${index}`}
                          render={({ field: formField }) => (
                            <FormItem>
                              <FormLabel className="text-white font-medium">Discord User ID:</FormLabel>
                              <FormControl>
                                <Input
                                  className="law-input text-white"
                                  placeholder="Ex: 1132477120665370674"
                                  {...formField}
                                  onChange={(e) => {
                                    formField.onChange(e.target.value);
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Violator Information Section */}
                <div className="grid grid-cols-1 gap-6">
                  <FormField
                    control={form.control}
                    name="violatorUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-medium">Violator's Discord ID:</FormLabel>
                        <FormControl>
                          <Input
                            className="law-input text-white"
                            placeholder="Ex: 1132477120665370674"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>



                {/* Penal Code(s) & Amount Due Section */}
                <div>
                  <h3 className="text-white text-lg font-semibold mb-4">Penal Code(s) & Amount Due:</h3>

                  {penalCodeFields.map((field, index) => (
                    <div key={`penalcode-${field.id}-${index}`} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <FormField
                        control={form.control}
                        name={`penalCodes.${index}`}
                        render={({ field: formField }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel className="text-white font-medium">Penal Code:</FormLabel>
                            <Popover 
                              open={openComboboxes[index] || false} 
                              onOpenChange={(open) => setOpenComboboxes(prev => ({ ...prev, [index]: open }))}
                            >
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                      "law-input text-white justify-between hover:bg-slate-600",
                                      !formField.value && "text-slate-400"
                                    )}
                                  >
                                    {formField.value ? (
                                      <span className="truncate">
                                        {PENAL_CODE_OPTIONS.find(option => option.code === formField.value)?.code || formField.value}
                                      </span>
                                    ) : (
                                      "Select penal code..."
                                    )}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-[400px] p-0 law-card">
                                <Command className="law-card">
                                  <CommandInput 
                                    placeholder="Search penal codes..." 
                                    className="text-white"
                                  />
                                  <CommandEmpty className="text-slate-400 p-4">
                                    No penal code found.
                                  </CommandEmpty>
                                  <CommandList>
                                    <CommandGroup>
                                      {PENAL_CODE_OPTIONS.map((option) => (
                                        <CommandItem
                                          key={option.code}
                                          value={`${option.code} ${option.description}`}
                                          onSelect={() => handlePenalCodeSelect(option.code, index)}
                                          className="text-white hover:bg-slate-600 cursor-pointer"
                                        >
                                          <div className="flex flex-col flex-1">
                                            <div className="flex justify-between items-center">
                                              <span className="font-medium">{option.code}</span>
                                              <div className="text-sm flex gap-2">
                                                <span className="text-green-400">${option.amount}</span>
                                              </div>
                                            </div>
                                            <span className="text-sm text-slate-300">{option.description}</span>
                                          </div>
                                          <Check
                                            className={cn(
                                              "ml-2 h-4 w-4",
                                              formField.value === option.code ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`amountsDue.${index}`}
                        render={({ field: formField }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel className="text-white font-medium">Amount Due:</FormLabel>
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-300 pointer-events-none">$</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  className="law-input text-white pl-8 bg-slate-600 cursor-not-allowed"
                                  {...formField}
                                  readOnly
                                />
                              </div>
                              {penalCodeFields.length > 1 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => removePenalCodeField(index)}
                                  className="bg-red-600 hover:bg-red-700 border-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ))}

                  <Button
                    type="button"
                    onClick={addPenalCodeField}
                    className="bg-slate-600 hover:bg-slate-500 text-white font-medium mb-6"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Penal Code
                  </Button>

                  {/* Total Amount Due */}
                  <div className="law-input rounded-md p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-white text-lg font-semibold">Total Amount Due (All Codes):</span>
                      <div className="bg-slate-600 rounded-md px-4 py-2">
                        <span className="text-white text-xl font-bold">
                          ${parseFloat(calculateTotal()).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Signature Section */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="violatorSignature"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-medium">Sign at the X (Discord User ID):</FormLabel>
                        <FormControl>
                          <Input
                            className="law-input text-blue-400 font-semibold"
                            placeholder="Ex: 1132477120665370674"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Additional Notes */}
                <FormField
                  control={form.control}
                  name="additionalNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white font-medium">Additional Notes:</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Provide details of the violation"
                          className="law-input text-white placeholder:text-slate-400 resize-vertical"
                          rows={4}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Form Actions */}
                <div className="flex flex-col sm:flex-row gap-4 pt-6">
                  <Button
                    type="submit"
                    disabled={submitMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => console.log("Submit button clicked")}
                  >
                    {submitMutation.isPending ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Submitting Citation...
                      </div>
                    ) : (
                      "Submit Citation"
                    )}
                  </Button>

                  <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        onClick={handleClearForm}
                        className="bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-6"
                      >
                        Clear Form
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="law-card border-slate-600">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">Clear Form Data</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-300">
                          Are you sure you want to clear all form data? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-slate-600 hover:bg-slate-500 text-white border-slate-500">
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={confirmClearForm}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          Clear Form
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog open={showBackDialog} onOpenChange={setShowBackDialog}>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        onClick={handleBackToSelection}
                        className="bg-slate-600 hover:bg-slate-500 text-white font-medium py-3 px-6"
                      >
                        Back to Home
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="law-card border-slate-600">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">Go Back to Home</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-300">
                          Are you sure you want to go back to the home page? Any unsaved changes will be lost.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-slate-600 hover:bg-slate-500 text-white border-slate-500">
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={confirmBackToHome}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Go Back
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}