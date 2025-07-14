import { useState, useEffect, useCallback, useRef } from "react";

// Simple debounce function
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
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
import { Plus, Trash2, Check, ChevronsUpDown, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

const arrestFormSchema = z.object({
  // Officer Information
  officerBadges: z.array(z.string().min(1, "Badge number is required")).min(1, "At least one officer badge is required").max(3, "Maximum 3 officers allowed"),
  officerUsernames: z.array(z.string().min(1, "Officer username is required")).min(1, "At least one officer username is required").max(3, "Maximum 3 officers allowed"),
  officerRanks: z.array(z.string().min(1, "Officer rank is required")).min(1, "At least one officer rank is required").max(3, "Maximum 3 officers allowed"),
  officerUserIds: z.array(z.string().min(1, "Officer Discord User ID is required")).min(1, "At least one officer Discord User ID is required").max(3, "Maximum 3 officers allowed"),

  // Description/Mugshot
  description: z.string().optional(),
  mugshotFile: z.any().optional(),

  // Offense Information
  penalCodes: z.array(z.string().min(1, "Penal code is required")).min(1, "At least one penal code is required"),
  amountsDue: z.array(z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount format")).min(1, "At least one amount is required"),
  jailTimes: z.array(z.string()).min(1, "At least one jail time is required"),
  totalAmount: z.string().default("0.00"),
  totalJailTime: z.string().default("0 Seconds"),
  timeServed: z.boolean().default(false),

  // Additional Information
  courtDate: z.string().default("XX/XX/XX"),
  courtLocation: z.string().default("4000 Capitol Drive, Greenville, Wisconsin 54942"),
  courtPhone: z.string().default("(262) 785-4700 ext. 7"),

  // Signatures
  suspectSignature: z.string().min(1, "Suspect signature is required"),
  officerSignatures: z.array(z.string().min(1, "Officer signature is required")).min(1, "At least one officer signature is required"),
}).refine((data) => {
  return data.description || data.mugshotFile;
}, {
  message: "Either description or mugshot is required",
  path: ["description"]
});

type ArrestFormData = z.infer<typeof arrestFormSchema>;

interface PenalCodeField {
  id: string;
  penalCode: string;
  amountDue: string;
  jailTime: string;
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

const PENAL_CODE_OPTIONS: PenalCodeOption[] = [
  // Section 1 - Criminal/Violence
  { code: "(1)01", description: "Criminal Threats", amount: "3750.00", jailTime: "60 Seconds" },
  { code: "(1)02", description: "Assault", amount: "3750.00", jailTime: "240 Seconds" },
  { code: "(1)03", description: "Assault with a Deadly Weapon", amount: "10000.00", jailTime: "120 Seconds" },
  { code: "(1)04", description: "Battery", amount: "1000.00", jailTime: "60 Seconds" },
  { code: "(1)05", description: "Aggravated Battery", amount: "0.00", jailTime: "120 Seconds" },
  { code: "(1)06", description: "Attempted Murder", amount: "10000.00", jailTime: "240 Seconds" },
  { code: "(1)07", description: "Manslaughter", amount: "0.00", jailTime: "270 Seconds" },
  { code: "(1)08", description: "Murder", amount: "0.00", jailTime: "600 Seconds" },
  { code: "(1)09", description: "False Imprisonment", amount: "1000.00", jailTime: "60 Seconds" },
  { code: "(1)10", description: "Kidnapping", amount: "0.00", jailTime: "210 Seconds" },
  { code: "(1)11", description: "Domestic Violence", amount: "1000.00", jailTime: "60 Seconds" },
  { code: "(1)12", description: "Domestic Violence (Physical Traumatic Injury)", amount: "10000.00", jailTime: "120 Seconds" },
  { code: "(1)13", description: "Assault on a Public Servant", amount: "1000.00", jailTime: "120 Seconds" },
  { code: "(1)14", description: "Attempted Assault on a Public Servant", amount: "1000.00", jailTime: "100 Seconds" },
  { code: "(1)15", description: "Assault on a Peace Officer", amount: "2000.00", jailTime: "180 Seconds" },

  // Section 2 - Property Crimes
  { code: "(2)01", description: "Arson", amount: "0.00", jailTime: "210 Seconds" },
  { code: "(2)02", description: "Trespassing", amount: "1000.00", jailTime: "15 Seconds" },
  { code: "(2)03", description: "Trespassing within a Restricted Facility", amount: "10000.00", jailTime: "60 Seconds" },
  { code: "(2)04", description: "Burglary", amount: "0.00", jailTime: "150 Seconds" },
  { code: "(2)05", description: "Possession of Burglary Tools", amount: "1000.00", jailTime: "60 Seconds" },
  { code: "(2)06", description: "Robbery", amount: "0.00", jailTime: "150 Seconds" },
  { code: "(2)07", description: "Armed Robbery", amount: "0.00", jailTime: "390 Seconds" },
  { code: "(2)08", description: "Petty Theft", amount: "1000.00", jailTime: "None" },
  { code: "(2)09", description: "Grand Theft", amount: "0.00", jailTime: "90 Seconds" },
  { code: "(2)10", description: "Grand Theft Auto", amount: "0.00", jailTime: "90 Seconds" },
  { code: "(2)11", description: "Receiving Stolen Property", amount: "10000.00", jailTime: "90 Seconds" },
  { code: "(2)12", description: "Extortion", amount: "10000.00", jailTime: "120 Seconds" },
  { code: "(2)13", description: "Forgery / Fraud", amount: "0.00", jailTime: "90 Seconds" },
  { code: "(2)14", description: "Vandalism", amount: "0.00", jailTime: "90 Seconds" },
  { code: "(2)15", description: "Loitering", amount: "1000.00", jailTime: "None" },
  { code: "(2)16", description: "Destruction of Civilian Property", amount: "1000.00", jailTime: "60 Seconds" },
  { code: "(2)17", description: "Destruction of Government Property", amount: "10000.00", jailTime: "120 Seconds" },

  // Section 3 - Public Order
  { code: "(3)01", description: "Lewd or Dissolute Conduct in Public", amount: "0.00", jailTime: "90 Seconds" },
  { code: "(3)02", description: "Stalking", amount: "0.00", jailTime: "90 Seconds" },
  { code: "(3)03", description: "Public Urination", amount: "0.00", jailTime: "120 Seconds" },
  { code: "(3)04", description: "Public Defecation", amount: "0.00", jailTime: "120 Seconds" },

  // Section 4 - Government/Law Enforcement
  { code: "(4)01", description: "Bribery", amount: "10000.00", jailTime: "120 Seconds" },
  { code: "(4)02", description: "Dissuading a Victim", amount: "0.00", jailTime: "60 Seconds" },
  { code: "(4)03", description: "False Information to a Peace Officer", amount: "0.00", jailTime: "30 Seconds" },
  { code: "(4)04", description: "Filing a False Police Report", amount: "0.00", jailTime: "60 Seconds" },
  { code: "(4)05", description: "Failure to Identify to a Peace Officer", amount: "1000.00", jailTime: "60 Seconds" },
  { code: "(4)06", description: "Impersonation of a Peace Officer", amount: "1000.00", jailTime: "60 Seconds" },
  { code: "(4)07", description: "Obstruction of a Peace Officer", amount: "1000.00", jailTime: "60 Seconds" },
  { code: "(4)08", description: "Resisting a Peace Officer", amount: "1000.00", jailTime: "120 Seconds" },
  { code: "(4)09", description: "Escape from Custody", amount: "1000.00", jailTime: "210 Seconds" },
  { code: "(4)10", description: "Prisoner Breakout", amount: "10000.00", jailTime: "90 Seconds" },
  { code: "(4)11", description: "Misuse of Government Hotline", amount: "1000.00", jailTime: "None" },
  { code: "(4)12", description: "Tampering with Evidence", amount: "1000.00", jailTime: "None" },
  { code: "(4)13", description: "Introduction of Contraband", amount: "0.00", jailTime: "120 Seconds" },
  { code: "(4)14", description: "False Arrest", amount: "10000.00", jailTime: "120 Seconds" },
  { code: "(4)15", description: "Assault on a Peace Officer", amount: "2000.00", jailTime: "180 Seconds" },
  { code: "(4)16", description: "Obstruction of Justice", amount: "500.00", jailTime: "60 Seconds" },
  { code: "(4)17", description: "Disorderly Conduct", amount: "1000.00", jailTime: "60 Seconds" },
  { code: "(4)18", description: "Failure to Comply with a Lawful Order", amount: "500.00", jailTime: "60 Seconds" },
  { code: "(4)19", description: "Aiding and Abetting", amount: "0.00", jailTime: "90 Seconds" },

  // Section 5 - Public Disturbance
  { code: "(5)01", description: "Disturbing the Peace", amount: "500.00", jailTime: "None" },
  { code: "(5)02", description: "Unlawful Assembly", amount: "0.00", jailTime: "90 Seconds" },
  { code: "(5)03", description: "Inciting Riot", amount: "1000.00", jailTime: "120 Seconds" },

  // Section 6 - Drug Related
  { code: "(6)04", description: "Maintaining a Place for the Purpose of Distribution", amount: "10000.00", jailTime: "90 Seconds" },
  { code: "(6)05", description: "Manufacture of a Controlled Substance", amount: "50000.00", jailTime: "180 Seconds" },
  { code: "(6)06", description: "Sale of a Controlled Substance", amount: "5000.00", jailTime: "180 Seconds" },
  { code: "(6)08", description: "Under the Influence of a Controlled Substance", amount: "2000.00", jailTime: "180 Seconds" },
  { code: "(6)09", description: "Detention of Mentally Disordered Persons", amount: "0.00", jailTime: "180 Seconds" },

  // Section 7 - Animal/Child
  { code: "(7)01", description: "Animal Abuse / Cruelty", amount: "20000.00", jailTime: "90 Seconds" },
  { code: "(7)04", description: "Child Endangerment", amount: "10000.00", jailTime: "60 Seconds" },

  // Section 8 - Traffic Violations
  { code: "(8)01", description: "Invalid / No Vehicle Registration / Insurance", amount: "200.00", jailTime: "None" },
  { code: "(8)02", description: "Driving Without a License", amount: "1000.00", jailTime: "None" },
  { code: "(8)03", description: "Driving With a Suspended or Revoked License", amount: "1000.00", jailTime: "60 Seconds" },
  { code: "(8)04", description: "Accident Reporting Requirements - Property Damage", amount: "1000.00", jailTime: "None" },
  { code: "(8)05", description: "Accident Reporting Requirements - Injury or Death", amount: "10000.00", jailTime: "120 Seconds" },
  { code: "(8)06", description: "Failure to Obey Traffic Signal", amount: "250.00", jailTime: "None" },
  { code: "(8)07", description: "Driving Opposite Direction", amount: "500.00", jailTime: "None" },
  { code: "(8)08", description: "Failure to Maintain Lane", amount: "250.00", jailTime: "None" },
  { code: "(8)09", description: "Unsafe Following Distance", amount: "250.00", jailTime: "None" },
  { code: "(8)10", description: "Failure to Yield to Civilian", amount: "250.00", jailTime: "None" },
  { code: "(8)11", description: "Failure to Yield to Emergency Vehicles", amount: "250.00", jailTime: "None" },
  { code: "(8)12", description: "Unsafe Turn", amount: "250.00", jailTime: "None" },
  { code: "(8)13", description: "Unsafe Lane Change", amount: "250.00", jailTime: "None" },
  { code: "(8)14", description: "Illegal U-Turn", amount: "250.00", jailTime: "None" },
  { code: "(8)15", description: "Speeding (5-15 MPH Over)", amount: "250.00", jailTime: "None" },
  { code: "(8)16", description: "Speeding (16-25 MPH Over)", amount: "360.00", jailTime: "None" },
  { code: "(8)17", description: "Speeding (26+ MPH Over)", amount: "500.00", jailTime: "None" },
  { code: "(8)18", description: "Felony Speeding (100 MPH+)", amount: "5000.00", jailTime: "30 Seconds" },
  { code: "(8)19", description: "Unreasonably Slow / Stopped", amount: "250.00", jailTime: "None" },
  { code: "(8)20", description: "Failure to Obey Stop Sign / RED LIGHT", amount: "250.00", jailTime: "None" },
  { code: "(8)21", description: "Illegally Parked", amount: "250.00", jailTime: "None" },
  { code: "(8)22", description: "Reckless Driving", amount: "1000.00", jailTime: "30 Seconds" },
  { code: "(8)23", description: "Street Racing", amount: "1000.00", jailTime: "30 Seconds" },
  { code: "(8)24", description: "Throwing Objects", amount: "1000.00", jailTime: "None" },
  { code: "(8)25", description: "Operating While Intoxicated", amount: "2000.00", jailTime: "60 Seconds" },
  { code: "(8)26", description: "Evading a Peace Officer", amount: "0.00", jailTime: "270 Seconds" },
  { code: "(8)29", description: "Felony Evading a Peace Officer", amount: "0.00", jailTime: "300 Seconds" },
  { code: "(8)30", description: "Road Rage", amount: "0.00", jailTime: "30 Seconds" },
  { code: "(8)31", description: "Littering", amount: "1000.00", jailTime: "None" },
  { code: "(8)32", description: "Unsafe Speed for Conditions", amount: "2000.00", jailTime: "None" },
  { code: "(8)33", description: "Hogging Passing Lane", amount: "250.00", jailTime: "None" },
  { code: "(8)34", description: "Impeding Traffic", amount: "250.00", jailTime: "None" },
  { code: "(8)35", description: "Jaywalking", amount: "250.00", jailTime: "None" },
  { code: "(8)36", description: "Unnecessary Use of Horn", amount: "400.00", jailTime: "None" },
  { code: "(8)37", description: "Excessive Music / Engine Sounds", amount: "400.00", jailTime: "None" },
  { code: "(8)38", description: "Failure to Sign Citation", amount: "250.00", jailTime: "30 Seconds" },
  { code: "(8)39", description: "Failure to Yield to Pedestrian", amount: "250.00", jailTime: "None" },
  { code: "(8)40", description: "Distracted Driving", amount: "1000.00", jailTime: "None" },
  { code: "(8)41", description: "Driving on Shoulder / Emergency Lane", amount: "250.00", jailTime: "None" },
  { code: "(8)42", description: "Move Over Law", amount: "1000.00", jailTime: "None" },
  { code: "(8)43", description: "Driving Without Headlights", amount: "250.00", jailTime: "None" },
  { code: "(8)44", description: "Hit and Run", amount: "500.00", jailTime: "None" },
  { code: "(8)45", description: "Attempted Vehicular Manslaughter", amount: "750.00", jailTime: "60 Seconds" },
  { code: "(8)46", description: "Vehicular Manslaughter", amount: "750.00", jailTime: "120 Seconds" },
  { code: "(8)47", description: "Reckless Evasion", amount: "750.00", jailTime: "120 Seconds" },
  { code: "(8)48", description: "Possession of a Stolen Vehicle", amount: "0.00", jailTime: "120 Seconds" },
  { code: "(8)49", description: "Reckless Endangerments", amount: "1000.00", jailTime: "60 Seconds" },
  { code: "(8)50", description: "Unroadworthy Vehicle", amount: "1000.00", jailTime: "None" },
  { code: "(8)51", description: "Drifting on a Public Road", amount: "250.00", jailTime: "None" },
  { code: "(8)52", description: "Failure to Control Vehicle", amount: "250.00", jailTime: "None" },
  { code: "(8)53", description: "Unsafe Parking (Parking Ticket)", amount: "100.00", jailTime: "None" },
  { code: "(8)54", description: "Failure to Use Turn Signal", amount: "100.00", jailTime: "None" },
  { code: "(8)55", description: "Failure to Display License Plate (W/ only)", amount: "300.00", jailTime: "None" },

  // Section 9 - Weapons
  { code: "(9)01", description: "Possession of an Illegal Weapon", amount: "1000.00", jailTime: "60 Seconds" },
  { code: "(9)02", description: "Brandishing a Firearm", amount: "1000.00", jailTime: "60 Seconds" },
  { code: "(9)03", description: "Illegal Discharge of a Firearm", amount: "0.00", jailTime: "90 Seconds" },
  { code: "(9)04", description: "Unlicensed Possession of a Firearm", amount: "0.00", jailTime: "90 Seconds" },
  { code: "(9)05", description: "Possession of a Stolen Weapon", amount: "0.00", jailTime: "90 Seconds" },
  { code: "(9)06", description: "Unlawful Distribution of a Firearm", amount: "0.00", jailTime: "90 Seconds" },
];

export default function ArrestForm() {
  const { primaryOfficerData, savedOfficerList, saveOfficerList, autoSaveProfile } = useOfficerProfile();

  const [penalCodeFields, setPenalCodeFields] = useState<PenalCodeField[]>([
    { id: "1", penalCode: "", amountDue: "", jailTime: "" }
  ]);
  const [officerFields, setOfficerFields] = useState<OfficerField[]>([
    { id: "1", badge: "", username: "", rank: "", userId: "" }
  ]);
  const [openComboboxes, setOpenComboboxes] = useState<{ [key: string]: boolean }>({});
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const { toast } = useToast();

  const form = useForm<ArrestFormData>({
    resolver: zodResolver(arrestFormSchema),
    defaultValues: {
      officerBadges: [""],
      officerUsernames: [""],
      officerRanks: [""],
      officerUserIds: [""],
      description: "",
      penalCodes: [""],
      amountsDue: [""],
      jailTimes: [""],
      totalAmount: "0.00",
      totalJailTime: "0 Seconds",
      timeServed: false,
      courtDate: "XX/XX/XX",
      courtLocation: "4000 Capitol Drive, Greenville, Wisconsin 54942",
      courtPhone: "(262) 785-4700 ext. 7",
      suspectSignature: "",
      officerSignatures: [""],
    },
  });

  // Load saved officer data from profile on component mount
  useEffect(() => {
    if (savedOfficerList && savedOfficerList.length > 0) {
      const newOfficerFields = savedOfficerList.map((officer, index) => ({
        id: (index + 1).toString(),
        badge: officer.badge,
        username: officer.username,
        rank: officer.rank,
        userId: officer.userId
      }));

      setOfficerFields(newOfficerFields);
      form.setValue("officerBadges", savedOfficerList.map(o => o.badge));
      form.setValue("officerUsernames", savedOfficerList.map(o => o.username));
      form.setValue("officerRanks", savedOfficerList.map(o => o.rank));
      form.setValue("officerUserIds", savedOfficerList.map(o => o.userId));
      form.setValue("officerSignatures", new Array(savedOfficerList.length).fill(""));
    } else if (primaryOfficerData) {
      // If no saved list but we have primary officer data, populate the first officer
      // Only use meaningful values (more than 1 character) for RP name
      const filteredUsername = primaryOfficerData.username && primaryOfficerData.username.length > 1 ? primaryOfficerData.username : "";
      
      const newOfficerFields = [{
        id: "1",
        badge: primaryOfficerData.badge,
        username: filteredUsername,
        rank: primaryOfficerData.rank,
        userId: primaryOfficerData.userId
      }];

      setOfficerFields(newOfficerFields);
      form.setValue("officerBadges", [primaryOfficerData.badge]);
      form.setValue("officerUsernames", [filteredUsername]);
      form.setValue("officerRanks", [primaryOfficerData.rank]);
      form.setValue("officerUserIds", [primaryOfficerData.userId]);
      form.setValue("officerSignatures", [""]);
    }
  }, []);

  // Save officer data only on form submission to prevent infinite loops

  const submitMutation = useMutation({
    mutationFn: async (data: ArrestFormData) => {
      // Include the base64 image data if there's an uploaded image but no description
      const submitData = {
        ...data,
        mugshotBase64: (!data.description && uploadedImage) ? uploadedImage : undefined
      };
      const response = await apiRequest("POST", "/api/arrests", submitData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Arrest Report Submitted",
        description: "The arrest report has been successfully submitted.",
        duration: 5000, // Auto-dismiss after 5 seconds
      });
      // Clear form after successful submission but keep officer info
      setTimeout(() => {
        autoClearFormKeepOfficers();
      }, 1000);
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit arrest report. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      form.setValue("mugshotFile", file);
      form.setValue("description", "");
    }
  };

  const removeImage = () => {
    setUploadedImage(null);
    setImageFile(null);
    form.setValue("mugshotFile", undefined);
  };

  const calculateTotal = () => {
    const amounts = form.getValues("amountsDue");
    const total = amounts.reduce((sum, amount) => {
      const num = parseFloat(amount) || 0;
      return sum + num;
    }, 0);
    form.setValue("totalAmount", total.toFixed(2));
    return total.toFixed(2);
  };

  const calculateTotalJailTime = () => {
    const jailTimes = form.getValues("jailTimes") || [];
    const totalSeconds = jailTimes.reduce((sum, jailTime) => {
      if (jailTime === "None" || jailTime === "") return sum;
      const seconds = parseInt(jailTime.replace(" Seconds", "")) || 0;
      return sum + seconds;
    }, 0);
    const totalJailTimeString = `${totalSeconds} Seconds`;
    form.setValue("totalJailTime", totalJailTimeString);
    return totalJailTimeString;
  };

  // Pure calculation functions that don't modify form state
  const getCalculatedTotal = () => {
    const amounts = form.getValues("amountsDue");
    return amounts.reduce((sum, amount) => {
      const num = parseFloat(amount) || 0;
      return sum + num;
    }, 0).toFixed(2);
  };

  const getCalculatedJailTime = () => {
    const jailTimes = form.getValues("jailTimes") || [];
    const totalSeconds = jailTimes.reduce((sum, jailTime) => {
      if (jailTime === "None" || jailTime === "") return sum;
      const seconds = parseInt(jailTime.replace(" Seconds", "")) || 0;
      return sum + seconds;
    }, 0);
    return totalSeconds;
  };

  const handlePenalCodeSelect = (selectedCode: string, index: number) => {
    const option = PENAL_CODE_OPTIONS.find(opt => opt.code === selectedCode);
    if (option) {
      const updatedFields = penalCodeFields.map((field, i) => 
        i === index 
          ? { ...field, penalCode: option.code, amountDue: option.amount, jailTime: option.jailTime }
          : field
      );
      setPenalCodeFields(updatedFields);

      const currentPenalCodes = form.getValues("penalCodes");
      const currentAmounts = form.getValues("amountsDue");
      const currentJailTimes = form.getValues("jailTimes");

      currentPenalCodes[index] = selectedCode;
      currentAmounts[index] = option.amount;
      currentJailTimes[index] = option.jailTime;

      form.setValue("penalCodes", currentPenalCodes);
      form.setValue("amountsDue", currentAmounts);
      form.setValue("jailTimes", currentJailTimes);

      setTimeout(() => {
        calculateTotal();
        calculateTotalJailTime();
      }, 0);
    }

    setOpenComboboxes(prev => ({ ...prev, [index]: false }));
  };

  const addPenalCodeField = () => {
    const newId = (penalCodeFields.length + 1).toString();
    setPenalCodeFields([...penalCodeFields, { id: newId, penalCode: "", amountDue: "", jailTime: "" }]);

    const currentPenalCodes = form.getValues("penalCodes");
    const currentAmounts = form.getValues("amountsDue");
    const currentJailTimes = form.getValues("jailTimes");
    form.setValue("penalCodes", [...currentPenalCodes, ""]);
    form.setValue("amountsDue", [...currentAmounts, ""]);
    form.setValue("jailTimes", [...currentJailTimes, ""]);
  };

  const removePenalCodeField = (index: number) => {
    if (penalCodeFields.length > 1) {
      const newFields = penalCodeFields.filter((_, i) => i !== index);
      setPenalCodeFields(newFields);

      const currentPenalCodes = form.getValues("penalCodes");
      const currentAmounts = form.getValues("amountsDue");
      const currentJailTimes = form.getValues("jailTimes");
      form.setValue("penalCodes", currentPenalCodes.filter((_, i) => i !== index));
      form.setValue("amountsDue", currentAmounts.filter((_, i) => i !== index));
      form.setValue("jailTimes", currentJailTimes.filter((_, i) => i !== index));
      calculateTotal();
      calculateTotalJailTime();
    }
  };

  const addOfficerField = () => {
    if (officerFields.length < 3) {
      const newId = (officerFields.length + 1).toString();
      setOfficerFields([...officerFields, { id: newId, badge: "", username: "", rank: "", userId: "" }]);

      const currentBadges = form.getValues("officerBadges");
      const currentUsernames = form.getValues("officerUsernames");
      const currentRanks = form.getValues("officerRanks");
      const currentUserIds = form.getValues("officerUserIds");

      form.setValue("officerBadges", [...currentBadges, ""]);
      form.setValue("officerUsernames", [...currentUsernames, ""]);
      form.setValue("officerRanks", [...currentRanks, ""]);
      form.setValue("officerUserIds", [...currentUserIds, ""]);

      // Add signature field for new officer
      const currentSignatures = form.getValues("officerSignatures");
      form.setValue("officerSignatures", [...currentSignatures, ""]);
    } else {
      toast({
        title: "Maximum Officers Reached",
        description: "Arrest reports are limited to 3 officers maximum (arresting officer + 2 assisting officers).",
        variant: "destructive",
      });
    }
  };

  const removeOfficerField = (index: number) => {
    if (officerFields.length > 1) {
      const newFields = officerFields.filter((_, i) => i !== index);
      setOfficerFields(newFields);

      const currentBadges = form.getValues("officerBadges");
      const currentUsernames = form.getValues("officerUsernames");
      const currentRanks = form.getValues("officerRanks");
      const currentUserIds = form.getValues("officerUserIds");

      form.setValue("officerBadges", currentBadges.filter((_, i) => i !== index));
      form.setValue("officerUsernames", currentUsernames.filter((_, i) => i !== index));
      form.setValue("officerRanks", currentRanks.filter((_, i) => i !== index));
      form.setValue("officerUserIds", currentUserIds.filter((_, i) => i !== index));

      // Remove signature field for removed officer
      const currentSignatures = form.getValues("officerSignatures");
      form.setValue("officerSignatures", currentSignatures.filter((_, i) => i !== index));
    }
  };

  const handleClearForm = () => {
    setShowClearDialog(true);
  };

  const confirmClearForm = () => {
    form.reset();
    setPenalCodeFields([{ id: "1", penalCode: "", amountDue: "", jailTime: "" }]);
    setOfficerFields([{ id: "1", badge: "", username: "", rank: "", userId: "" }]);
    setUploadedImage(null);
    setImageFile(null);
    setShowClearDialog(false);
  };

  const autoClearFormKeepOfficers = () => {
    // Save current officer information
    const currentOfficerBadges = form.getValues("officerBadges");
    const currentOfficerUsernames = form.getValues("officerUsernames");
    const currentOfficerRanks = form.getValues("officerRanks");
    const currentOfficerUserIds = form.getValues("officerUserIds");
    const currentOfficerSignatures = form.getValues("officerSignatures");

    // Save current officer fields state
    const currentOfficerFields = [...officerFields];

    // Reset only non-officer fields without calling form.reset()
    setPenalCodeFields([{ id: "1", penalCode: "", amountDue: "", jailTime: "" }]);
    form.setValue("penalCodes", [""]);
    form.setValue("amountsDue", [""]);
    form.setValue("jailTimes", [""]);
    form.setValue("totalAmount", "0.00");
    form.setValue("totalJailTime", "0 Seconds");
    form.setValue("description", "");
    form.setValue("timeServed", false);
    form.setValue("suspectSignature", "");

    // Clear image upload
    setUploadedImage(null);
    setImageFile(null);
    form.setValue("mugshotFile", undefined);

    // Keep court information as defaults
    form.setValue("courtDate", "XX/XX/XX");
    form.setValue("courtLocation", "4000 Capitol Drive, Greenville, Wisconsin 54942");
    form.setValue("courtPhone", "(262) 785-4700 ext. 7");

    // Ensure officer information is preserved
    form.setValue("officerBadges", currentOfficerBadges);
    form.setValue("officerUsernames", currentOfficerUsernames);
    form.setValue("officerRanks", currentOfficerRanks);
    form.setValue("officerUserIds", currentOfficerUserIds);
    form.setValue("officerSignatures", currentOfficerSignatures);

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

  

  const onSubmit = (data: ArrestFormData) => {
    // Save officer information before submitting
    const validOfficers = officerFields.filter(field => 
      field.badge.trim() && field.username.trim() && field.rank.trim() && field.userId.trim()
    );

    if (validOfficers.length > 0) {
      saveOfficerList(validOfficers);

      // Also update primary officer profile if first officer has all data
      if (validOfficers[0]) {
        autoSaveProfile(validOfficers[0]);
      }
    }

    submitMutation.mutate(data);
  };

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: "var(--law-primary)" }}>
      <div className="max-w-4xl mx-auto">
        <Card className="law-card shadow-2xl">
          <CardContent className="p-8">
            <h1 className="text-white text-2xl font-semibold text-center mb-2">Arrest Report</h1>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">


                {/* Law Enforcement Information */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white text-lg font-semibold">Law Enforcement Information:</h3>
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
                    <div key={field.id} className="space-y-4 mb-6 p-4 rounded-lg border border-slate-600 bg-slate-800/50">
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

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <FormField
                          control={form.control}
                          name={`officerBadges.${index}`}
                          render={({ field: formField }) => (
                            <FormItem>
                              <FormLabel className="text-white font-medium">Badge #:</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="N/A"
                                  className="law-input text-white placeholder:text-slate-400"
                                  {...formField}
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
                                  className="law-input text-blue-400 font-semibold"
                                  placeholder="Ex: P.Popfork1"
                                  {...formField}
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
                                  className="law-input text-blue-400 font-semibold"
                                  placeholder="Ex: 1132477120665370674"
                                  {...formField}
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

                {/* Description/Mugshot Section */}
                <div>
                  <h3 className="text-white text-lg font-semibold mb-4 underline">Description/Mugshot</h3>

                  {/* Image Upload */}
                  <div className="mb-4">
                    {!uploadedImage ? (
                      <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center">
                        <Upload className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                        <p className="text-slate-300 mb-4">Upload mugshot image (optional)</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          id="mugshot-upload"
                        />
                        <label
                          htmlFor="mugshot-upload"
                          className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded cursor-pointer inline-block"
                        >
                          Choose Image
                        </label>
                      </div>
                    ) : (
                      <div className="relative">
                        <img
                          src={uploadedImage}
                          alt="Mugshot"
                          className="max-w-xs max-h-64 rounded-lg mx-auto block"
                        />
                        <Button
                          type="button"
                          onClick={removeImage}
                          className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 rounded-full p-1"
                          size="sm"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Description - only show if no image uploaded */}
                  {!uploadedImage && (
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white font-medium">Description (required if no mugshot)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Ex: Suit, Brown hair, Blocky."
                              className="law-input text-white placeholder:text-slate-400 resize-vertical"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Offense Section */}
                <div>
                  <h3 className="text-white text-lg font-semibold mb-4 underline">Offense:</h3>

                  {penalCodeFields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
                                                {option.amount !== "0.00" && (
                                                  <span className="text-green-400">${option.amount}</span>
                                                )}
                                                <span className="text-orange-400">
                                                  {option.jailTime === "None" ? "(No Jailtime For Committed Offense)" : option.jailTime}
                                                </span>
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
                            <FormLabel className="text-white font-medium">
                              {penalCodeFields[index]?.jailTime && penalCodeFields[index]?.jailTime !== "None" ? "Amount Due & Jail Time:" : "Amount Due:"}
                            </FormLabel>
                            <div className="flex gap-2">
                              {(!penalCodeFields[index]?.amountDue || penalCodeFields[index]?.amountDue !== "0.00") && (
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
                              )}

                              <div className="relative flex-1">
                                <Input
                                  type="text"
                                  value={penalCodeFields[index]?.jailTime === "None" ? "(No Jailtime For Committed Offense)" : (penalCodeFields[index]?.jailTime || "")}
                                  readOnly
                                  placeholder="Jail Time"
                                  className="law-input text-white bg-slate-700"
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
                    Add Another Offense
                  </Button>

                  {/* Total Information */}
                  <div className="space-y-4">
                    {/* Total Amount Due */}
                    <div className="law-input rounded-md p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-white text-lg font-semibold">Total Amount Due (All Codes):</span>
                        <div className="bg-green-600 rounded-md px-4 py-2">
                          <span className="text-white text-xl font-bold">
                            ${getCalculatedTotal()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Total Jail Time */}
                    <div className="law-input rounded-md p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-white text-lg font-semibold">Total Jail Time (All Codes):</span>
                        <div className="bg-orange-600 rounded-md px-4 py-2">
                          <span className="text-white text-xl font-bold">
                            {getCalculatedJailTime()} Seconds
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Time Served Checkbox */}
                    <FormField
                      control={form.control}
                      name="timeServed"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 law-input rounded-md p-4">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4 text-blue-600 rounded border-gray-300"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-white font-medium">
                              Time Served (Check if jail time has been served)
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />

                    {/* Time Remaining On Sentence - only show when Time Served is unchecked */}
                    {!form.watch("timeServed") && (
                      <div className="law-input rounded-md p-4">
                        <div className="space-y-4">
                          <h4 className="text-white text-lg font-semibold">Time Remaining On Sentence:</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-white font-medium block mb-2">Adjust Time (Seconds):</label>
                              <FormField
                                control={form.control}
                                name="totalJailTime"
                                render={({ field }) => {
                                  const currentSeconds = parseInt((field.value || "0 Seconds").replace(" Seconds", "")) || 0;
                                  const maxSeconds = getCalculatedJailTime();

                                  return (
                                    <FormItem>
                                      <FormControl>
                                        <input
                                          type="number"
                                          min="0"
                                          max={maxSeconds}
                                          value={currentSeconds}
                                          onChange={(e) => {
                                            const newValue = Math.max(0, Math.min(parseInt(e.target.value) || 0, maxSeconds));
                                            field.onChange(`${newValue} Seconds`);
                                          }}
                                          className="law-input text-white w-full"
                                          placeholder="0"
                                        />
                                      </FormControl>
                                    </FormItem>
                                  );
                                }}
                              />
                              <p className="text-slate-400 text-sm mt-1">
                                Maximum: {getCalculatedJailTime()} seconds (calculated from all offenses)
                              </p>
                            </div>
                            <div>
                              <label className="text-white font-medium block mb-2">Final Sentence:</label>
                              <div className="bg-orange-600 rounded-md px-4 py-2 text-center">
                                <span className="text-white text-xl font-bold">
                                  {form.watch("totalJailTime") || "0 Seconds"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Warrant Needed Section */}
                    <div className="law-input rounded-md p-4">
                      <div className="space-y-4">
                        <h4 className="text-white text-lg font-semibold">Warrant Information:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-white font-medium block mb-2">Warrant Needed:</label>
                            <div className={`rounded-md px-4 py-2 text-center ${
                              (() => {
                                const remainingSeconds = !form.watch("timeServed") 
                                  ? parseInt((form.watch("totalJailTime") || "0 Seconds").replace(" Seconds", "")) || 0
                                  : 0;
                                return remainingSeconds > 0 ? "bg-red-600" : "bg-green-600";
                              })()
                            }`}>
                              <span className="text-white text-xl font-bold">
                                {(() => {
                                  const remainingSeconds = !form.watch("timeServed") 
                                    ? parseInt((form.watch("totalJailTime") || "0 Seconds").replace(" Seconds", "")) || 0
                                    : 0;
                                  return remainingSeconds > 0 ? "Yes" : "No";
                                })()}
                              </span>
                            </div>
                          </div>
                          <div>
                            <label className="text-white font-medium block mb-2">Time Needed for Warrant:</label>
                            <div className="bg-blue-600 rounded-md px-4 py-2 text-center">
                              <span className="text-white text-xl font-bold">
                                {(() => {
                                  const remainingSeconds = !form.watch("timeServed") 
                                    ? parseInt((form.watch("totalJailTime") || "0 Seconds").replace(" Seconds", "")) || 0
                                    : 0;
                                  return remainingSeconds > 0 ? `${remainingSeconds} Seconds` : "0 Seconds";
                                })()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <p className="text-slate-400 text-sm">
                          A warrant is needed when there is remaining jail time that has not been served.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Signature Section */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="suspectSignature"
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

                  {/* Officer Signatures - Dynamic based on number of officers */}
                  {officerFields.map((field, index) => (
                    <FormField
                      key={`officer-signature-${field.id}`}
                      control={form.control}
                      name={`officerSignatures.${index}`}
                      render={({ field: formField }) => (
                        <FormItem>
                          <FormLabel className="text-white font-medium">
                            {index === 0 ? "Arresting" : "Assisting"} Officer #{index + 1} Signature (Discord User ID):
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="law-input text-white"
                              placeholder="Ex: 1132477120665370674"
                              {...formField}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>

                {/* Court Information */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="courtLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-medium">Court Location:</FormLabel>
                        <FormControl>
                          <Input
                            className="law-input text-white bg-slate-600 cursor-not-allowed"
                            {...field}
                            readOnly
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="courtDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-medium">Court date:</FormLabel>
                        <FormControl>
                          <Input
                            className="law-input text-white bg-slate-600 cursor-not-allowed"
                            {...field}
                            readOnly
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="courtPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white font-medium">Please call for further inquiry:</FormLabel>
                        <FormControl>
                          <Input
                            className="law-input text-white bg-slate-600 cursor-not-allowed"
                            {...field}
                            readOnly
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Form Actions */}
                <div className="flex flex-col sm:flex-row gap-4 pt-6">
                  <Button
                    type="submit"
                    disabled={submitMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 flex-1 sm:flex-none"
                  >
                    {submitMutation.isPending ? "Submitting..." : "Submit Arrest Report"}
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