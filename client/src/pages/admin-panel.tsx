import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, Shield, ShieldCheck, Trash2, ArrowLeft, Search, Eye, Calendar, Filter, Edit } from "lucide-react";
import { Link } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format, isAfter, isBefore, startOfMonth, endOfMonth, subMonths } from "date-fns";

// Enhanced Citations Section Component
function CitationsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedCitation, setSelectedCitation] = useState<any>(null);

  const { data: citations } = useQuery({
    queryKey: ["/api/admin/citations"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/citations");
      if (!response.ok) {
        throw new Error("Failed to fetch citations");
      }
      return response.json();
    },
  });

  const deleteCitationMutation = useMutation({
    mutationFn: async (citationId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/citations/${citationId}`);
      if (!response.ok) {
        throw new Error("Failed to delete citation");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/citations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Success",
        description: "Citation deleted successfully from both database and Discord",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete citation",
        variant: "destructive",
      });
    },
  });

  const deleteAllCitationsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/admin/citations/all");
      if (!response.ok) {
        throw new Error("Failed to delete all citations");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/citations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Success",
        description: `${data.deletedCount} citations deleted successfully`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete all citations",
        variant: "destructive",
      });
    },
  });

  // Filter citations based on search and date
  const filteredCitations = useMemo(() => {
    if (!citations) return [];

    let filtered = citations.filter((citation: any) => {
      const searchMatch = 
        citation.violatorUsername.toLowerCase().includes(searchTerm.toLowerCase()) ||
        citation.officerUsernames.some((name: string) => name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        citation.penalCodes.some((code: string) => code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        citation.id.toLowerCase().includes(searchTerm.toLowerCase());

      if (!searchMatch) return false;

      // Date filtering
      const citationDate = new Date(citation.createdAt);
      const now = new Date();

      switch (dateFilter) {
        case "thisMonth":
          return isAfter(citationDate, startOfMonth(now)) && isBefore(citationDate, endOfMonth(now));
        case "lastMonth":
          const lastMonth = subMonths(now, 1);
          return isAfter(citationDate, startOfMonth(lastMonth)) && isBefore(citationDate, endOfMonth(lastMonth));
        case "last3Months":
          const threeMonthsAgo = subMonths(now, 3);
          return isAfter(citationDate, threeMonthsAgo);
        default:
          return true;
      }
    });

    return filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [citations, searchTerm, dateFilter]);

  if (!citations || citations.length === 0) {
    return (
      <div className="text-center py-8">
        <ShieldCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-400">No citations found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search citations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
              <SelectItem value="last3Months">Last 3 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={filteredCitations.length === 0}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All Citations ({filteredCitations.length})
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-slate-900 border-slate-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">Delete All Citations</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-300">
                This will permanently delete all {citations.length} citations from the database and Discord. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteAllCitationsMutation.mutate()}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete All Citations
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Results Summary */}
      <div className="text-sm text-gray-600">
        Showing {filteredCitations.length} of {citations.length} citations
      </div>

      {/* Citations List */}
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {filteredCitations.map((citation: any) => (
          <Card key={citation.id} className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">ID: {citation.id}</Badge>
                    <Badge variant="secondary">{citation.violationType}</Badge>
                    <span className="text-sm text-gray-500">
                      {format(new Date(citation.createdAt), "MMM dd, yyyy 'at' h:mm a")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Violator:</strong> {citation.violatorUsername}
                    </div>
                    <div>
                      <strong>Officer:</strong> {citation.officerUsernames.join(", ")}
                    </div>
                    <div>
                      <strong>Total Amount:</strong> ${citation.totalAmount}
                    </div>
                    <div>
                      <strong>Jail Time:</strong> {citation.totalJailTime}
                    </div>
                  </div>
                  <div className="mt-2">
                    <strong>Penal Codes:</strong> {citation.penalCodes.join(", ")}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => setSelectedCitation(citation)}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-slate-900 border-slate-700 text-white">
                      <DialogHeader>
                        <DialogTitle className="text-white">Citation Details - {citation.id}</DialogTitle>
                        <DialogDescription className="text-slate-300">
                          Complete citation information and details
                        </DialogDescription>
                      </DialogHeader>
                      {selectedCitation && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-semibold mb-2">Basic Information</h4>
                              <div className="space-y-1 text-sm text-white">
                                <div><strong>Citation ID:</strong> {selectedCitation.id}</div>
                                <div><strong>Type:</strong> {selectedCitation.violationType}</div>
                                <div><strong>Created:</strong> {format(new Date(selectedCitation.createdAt), "PPPp")}</div>
                                <div><strong>Updated:</strong> {format(new Date(selectedCitation.updatedAt), "PPPp")}</div>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold mb-2">Violator Information</h4>
                              <div className="space-y-1 text-sm text-white">
                                <div><strong>Username:</strong> {selectedCitation.violatorUsername}</div>
                                <div><strong>Signature:</strong> {selectedCitation.violatorSignature}</div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-semibold mb-2">Officer Information</h4>
                            <div className="space-y-1 text-sm text-white">
                              <div><strong>Badges:</strong> {selectedCitation.officerBadges.join(", ")}</div>
                              <div><strong>Usernames:</strong> {selectedCitation.officerUsernames.join(", ")}</div>
                              <div><strong>Ranks:</strong> {selectedCitation.officerRanks.join(", ")}</div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-semibold mb-2">Violations & Penalties</h4>
                            <div className="space-y-2">
                              {selectedCitation.penalCodes.map((code: string, index: number) => (
                                <div key={index} className="flex justify-between items-center p-2 bg-slate-700 rounded">
                                  <span className="font-mono text-white">{code}</span>
                                  <div className="text-right">
                                    <div className="font-semibold text-white">${selectedCitation.amountsDue[index]}</div>
                                    <div className="text-sm text-slate-300">{selectedCitation.jailTimes[index]}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-4 p-3 bg-blue-900/50 rounded border border-blue-600">
                              <div className="flex justify-between items-center">
                                <span className="font-semibold text-white">Total Amount:</span>
                                <span className="text-xl font-bold text-white">${selectedCitation.totalAmount}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="font-semibold text-white">Total Jail Time:</span>
                                <span className="font-semibold text-white">{selectedCitation.totalJailTime}</span>
                              </div>
                            </div>
                          </div>

                          {selectedCitation.additionalNotes && (
                            <div>
                              <h4 className="font-semibold mb-2">Additional Notes</h4>
                              <p className="text-sm bg-slate-700 text-white p-3 rounded">{selectedCitation.additionalNotes}</p>
                            </div>
                          )}

                          {selectedCitation.discordMessageId && (
                            <div>
                              <h4 className="font-semibold mb-2">Discord Integration</h4>
                              <div className="text-sm text-white">
                                <strong>Message ID:</strong> {selectedCitation.discordMessageId}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        disabled={deleteCitationMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-slate-900 border-slate-700">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">Delete Citation</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-300">
                          Are you sure you want to delete this citation? This will also remove it from Discord if applicable.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteCitationMutation.mutate(citation.id)}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          Delete Citation
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Enhanced Arrests Section Component
function ArrestsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedArrest, setSelectedArrest] = useState<any>(null);

  const { data: arrests } = useQuery({
    queryKey: ["/api/admin/arrests"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/arrests");
      if (!response.ok) {
        throw new Error("Failed to fetch arrests");
      }
      return response.json();
    },
  });

  const deleteArrestMutation = useMutation({
    mutationFn: async (arrestId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/arrests/${arrestId}`);
      if (!response.ok) {
        throw new Error("Failed to delete arrest");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/arrests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Success",
        description: "Arrest deleted successfully from both database and Discord",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete arrest",
        variant: "destructive",
      });
    },
  });

  const deleteAllArrestsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/admin/arrests/all");
      if (!response.ok) {
        throw new Error("Failed to delete all arrests");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/arrests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Success",
        description: `${data.deletedCount} arrests deleted successfully`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete all arrests",
        variant: "destructive",
      });
    },
  });

  // Filter arrests based on search and date
  const filteredArrests = arrests?.filter((arrest: any) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      (arrest.suspectUsername && arrest.suspectUsername.toLowerCase().includes(searchLower)) ||
      (arrest.suspectSignature && arrest.suspectSignature.toLowerCase().includes(searchLower)) ||
      (arrest.officerUsernames && Array.isArray(arrest.officerUsernames) && arrest.officerUsernames.some((username: string) => username && username.toLowerCase().includes(searchLower))) ||
      (arrest.penalCodes && Array.isArray(arrest.penalCodes) && arrest.penalCodes.some((code: string) => code && code.toLowerCase().includes(searchLower))) ||
      (arrest.id && arrest.id.toLowerCase().includes(searchLower));

    const matchesDate = dateFilter === "all" || (() => {
      const createdDate = new Date(arrest.createdAt);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - createdDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      switch (dateFilter) {
        case "today": return diffDays <= 1;
        case "week": return diffDays <= 7;
        case "month": return diffDays <= 30;
        default: return true;
      }
    })();

    return matchesSearch && matchesDate;
  }) || [];

  if (!arrests || arrests.length === 0) {
    return (
      <div className="text-center py-8">
        <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-400">No arrests found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search arrests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
              <SelectItem value="last3Months">Last 3 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={filteredArrests.length === 0}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All Arrests ({filteredArrests.length})
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-slate-900 border-slate-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">Delete All Arrests</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-300">
                This will permanently delete all {arrests.length} arrests from the database and Discord. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteAllArrestsMutation.mutate()}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete All Arrests
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Results Summary */}
      <div className="text-sm text-gray-600">
        Showing {filteredArrests.length} of {arrests.length} arrests
      </div>

      {/* Arrests List */}
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {filteredArrests.map((arrest: any) => (
          <Card key={arrest.id} className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">ID: {arrest.id}</Badge>
                    <Badge variant="destructive">Arrest</Badge>
                    <span className="text-sm text-gray-500">
                      {format(new Date(arrest.createdAt), "MMM dd, yyyy 'at' h:mm a")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Suspect:</strong> {arrest.suspectUsername}
                    </div>
                    <div>
                      <strong>Officer:</strong> {arrest.officerUsernames.join(", ")}
                    </div>
                    <div>
                      <strong>Total Amount:</strong> ${arrest.totalAmount}
                    </div>
                    <div>
                      <strong>Jail Time:</strong> {arrest.totalJailTime}
                    </div>
                  </div>
                  <div className="mt-2">
                    <strong>Penal Codes:</strong> {arrest.penalCodes.join(", ")}
                  </div>
                  <div className="mt-2">
                    <strong>Location:</strong> {arrest.arrestLocation}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => setSelectedArrest(arrest)}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-slate-900 border-slate-700 text-white">
                      <DialogHeader>
                        <DialogTitle className="text-white">Arrest Details - {arrest.id}</DialogTitle>
                        <DialogDescription className="text-slate-300">
                          Complete arrest report information and details
                        </DialogDescription>
                      </DialogHeader>
                      {selectedArrest && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-semibold mb-2">Basic Information</h4>
                              <div className="space-y-1 text-sm text-white">
                                <div><strong>Arrest ID:</strong> {selectedArrest.id}</div>
                                <div><strong>Created:</strong> {format(new Date(selectedArrest.createdAt), "PPPp")}</div>
                                <div><strong>Updated:</strong> {format(new Date(selectedArrest.updatedAt), "PPPp")}</div>
                                <div><strong>Location:</strong> {selectedArrest.arrestLocation}</div>
                                <div><strong>Time:</strong> {selectedArrest.arrestTime}</div>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold mb-2">Suspect Information</h4>
                              <div className="space-y-1 text-sm text-white">
                                <div><strong>Username:</strong> {selectedArrest.suspectUsername}</div>
                                <div><strong>Signature:</strong> {selectedArrest.suspectSignature}</div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-semibold mb-2">Officer Information</h4>
                            <div className="space-y-1 text-sm text-white">
                              <div><strong>Badges:</strong> {selectedArrest.officerBadges.join(", ")}</div>
                              <div><strong>Usernames:</strong> {selectedArrest.officerUsernames.join(", ")}</div>
                              <div><strong>Ranks:</strong> {selectedArrest.officerRanks.join(", ")}</div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-semibold mb-2">Charges & Penalties</h4>
                            <div className="space-y-2">
                              {selectedArrest.penalCodes.map((code: string, index: number) => (
                                <div key={index} className="flex justify-between items-center p-2 bg-slate-700 rounded">
                                  <span className="font-mono text-white">{code}</span>
                                  <div className="text-right">
                                    <div className="font-semibold text-white">${selectedArrest.amountsDue[index]}</div>
                                    <div className="text-sm text-slate-300">{selectedArrest.jailTimes[index]}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-4 p-3 bg-red-900/50 rounded border border-red-600">
                              <div className="flex justify-between items-center">
                                <span className="font-semibold text-white">Total Amount:</span>
                                <span className="text-xl font-bold text-white">${selectedArrest.totalAmount}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="font-semibold text-white">Total Jail Time:</span>
                                <span className="font-semibold text-white">{selectedArrest.totalJailTime}</span>
                              </div>
                            </div>
                          </div>

                          {selectedArrest.arrestNotes && (
                            <div>
                              <h4 className="font-semibold mb-2">Arrest Notes</h4>
                              <p className="text-sm bg-slate-700 text-white p-3 rounded whitespace-pre-wrap">{selectedArrest.arrestNotes}</p>
                            </div>
                          )}

                          {selectedArrest.mugshotData && (
                            <div>
                              <h4 className="font-semibold mb-2">Mugshot</h4>
                              <img 
                                src={selectedArrest.mugshotData} 
                                alt="Mugshot" 
                                className="max-w-xs max-h-64 rounded border"
                              />
                            </div>
                          )}

                          {selectedArrest.discordMessageId && (
                            <div>
                              <h4 className="font-semibold mb-2">Discord Integration</h4>
                              <div className="text-sm text-white">
                                <strong>Message ID:</strong> {selectedArrest.discordMessageId}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        disabled={deleteArrestMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-slate-900 border-slate-700">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">Delete Arrest</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-300">
                          Are you sure you want to delete this arrest record? This will also remove it from Discord if applicable.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteArrestMutation.mutate(arrest.id)}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          Delete Arrest
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// User interface for admin panel
interface User {
  id: number;
  username: string;
  isAdmin: string;
}

export default function AdminPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; userId: number; username: string }>({ open: false, userId: 0, username: "" });
  const [terminateDialog, setTerminateDialog] = useState<{ open: boolean; username: string }>({ open: false, username: "" });
  const [blockUsernameInput, setBlockUsernameInput] = useState("");
  const [editRankDialog, setEditRankDialog] = useState<{ open: boolean; userId: number; username: string; currentRank: string }>({ open: false, userId: 0, username: "", currentRank: "" });
  const [newRank, setNewRank] = useState("");

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/auth/me");
      if (!response.ok) {
        throw new Error("Failed to fetch current user");
      }
      return response.json();
    },
  });

  const { data: users, isLoading, error } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/users");
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      return response.json();
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/stats");
      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }
      return response.json();
    },
  });

  const { data: blockedUsernames, refetch: refetchBlocked } = useQuery({
    queryKey: ["/api/admin/blocked-usernames"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/blocked-usernames");
      if (!response.ok) {
        throw new Error("Failed to fetch blocked users");
      }
      return response.json();
    },
  });

  const { data: terminatedUsernames, refetch: refetchTerminated } = useQuery({
    queryKey: ["/api/admin/terminated-usernames"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/terminated-usernames");
      if (!response.ok) {
        throw new Error("Failed to fetch terminated users");
      }
      return response.json();
    },
  });

  // Helper function to check if a username is terminated
  const isUsernameTerminated = (username: string) => {
    return terminatedUsernames?.some((terminated: any) => 
      terminated.username.toLowerCase() === username.toLowerCase()
    );
  };

  // Filter users based on search term
  const filteredUsers = users?.filter((user: User) =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.id.toString().includes(searchTerm)
  );

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("DELETE", `/api/admin/users/${userId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete user");
      }
      return response.json();
    },
    onSuccess: (data, userId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDeleteDialog({ open: false, userId: 0, username: "" });
      toast({
        title: "Success",
        description: data.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const makeAdminMutation = useMutation({
    mutationFn: async ({ userId, makeAdmin }: { userId: number; makeAdmin: boolean }) => {
      const response = await apiRequest("PUT", `/api/admin/users/${userId}/admin`, { isAdmin: makeAdmin });
      if (!response.ok) {
        throw new Error("Failed to update admin status");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "Admin status updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update admin status",
        variant: "destructive",
      });
    },
  });

  const updateRankMutation = useMutation({
    mutationFn: async ({ userId, rank }: { userId: number; rank: string }) => {
      const response = await apiRequest("PUT", `/api/admin/users/${userId}/rank`, { rank });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update rank");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditRankDialog({ open: false, userId: 0, username: "", currentRank: "" });
      setNewRank("");
      toast({
        title: "Success",
        description: data.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const blockUsernameMutation = useMutation({
    mutationFn: async (username: string) => {
      const response = await apiRequest("POST", "/api/admin/blocked-usernames", { username });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to block username");
      }
      return response.json();
    },
    onSuccess: (data) => {
      refetchBlocked();
      setBlockUsernameInput("");
      toast({
        title: "Success",
        description: data.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const unblockUsernameMutation = useMutation({
    mutationFn: async (username: string) => {
      const response = await apiRequest("DELETE", `/api/admin/blocked-usernames/${username}`);
      if (!response.ok) {
        throw new Error("Failed to unblock username");
      }
      return response.json();
    },
    onSuccess: () => {
      refetchBlocked();
      toast({
        title: "Success",
        description: "Username unblocked successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to unblock username",
        variant: "destructive",
      });
    },
  });

  const terminateUsernameMutation = useMutation({
    mutationFn: async (username: string) => {
      const response = await apiRequest("POST", "/api/admin/terminated-usernames", { username });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to terminate username");
      }
      return response.json();
    },
    onSuccess: (data) => {
      refetchTerminated();
      setTerminateDialog({ open: false, username: "" });
      toast({
        title: "Success",
        description: data.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const unterminateUsernameMutation = useMutation({
    mutationFn: async (username: string) => {
      const response = await apiRequest("DELETE", `/api/admin/terminated-usernames/${username}`);
      if (!response.ok) {
        throw new Error("Failed to unterminate username");
      }
      return response.json();
    },
    onSuccess: () => {
      refetchTerminated();
      toast({
        title: "Success",
        description: "Username unterminated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to unterminate username",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: "var(--law-primary)" }}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Portal
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
              <p className="text-slate-300">Manage users, citations, and arrests</p>
            </div>
          </div>
          <div className="text-right text-sm text-slate-300">
            Logged in as <span className="font-semibold text-white">{currentUser?.username}</span>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.userCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Citations</CardTitle>
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.citationCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Arrests</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.arrestCount}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs for different sections */}
        <div className="space-y-6">
          {/* Citations Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Citations Management
              </CardTitle>
              <CardDescription>
                View, search, filter, and manage all citations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CitationsSection />
            </CardContent>
          </Card>

          {/* Arrests Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Arrests Management
              </CardTitle>
              <CardDescription>
                View, search, filter, and manage all arrests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ArrestsSection />
            </CardContent>
          </Card>
        </div>

        {/* Users Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>
              Manage user accounts and admin permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredUsers?.map((user: User) => {
                  const isTerminated = isUsernameTerminated(user.username);
                  const isCurrentUser = currentUser?.id === user.id;
                  const isPopfork1 = user.username.toLowerCase() === 'popfork1';
                  const isProtectedUser = isCurrentUser || isPopfork1;

                  return (
                    <div
                      key={user.id}
                      className={`flex items-center justify-between p-3 border rounded-lg ${
                        isTerminated ? 'bg-red-900/20 border-red-600' : 'bg-slate-800 border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-medium flex items-center gap-2 text-white">
                            {user.username}
                            {user.isAdmin === "true" && (
                              <Badge variant="secondary">Admin</Badge>
                            )}
                            {isTerminated && (
                              <Badge variant="destructive">Terminated</Badge>
                            )}
                            {isPopfork1 && (
                              <Badge variant="default">Owner</Badge>
                            )}
                            {isCurrentUser && !isPopfork1 && (
                              <Badge variant="outline">You</Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-300">
                            ID: {user.id} | Rank: {user.rank || "Officer"}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditRankDialog({ 
                              open: true, 
                              userId: user.id, 
                              username: user.username, 
                              currentRank: user.rank || "Officer" 
                            });
                            setNewRank(user.rank || "Officer");
                          }}
                          disabled={isProtectedUser}
                          title={isProtectedUser ? "Cannot modify protected user's rank" : "Edit user rank"}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit Rank
                        </Button>

                        {user.isAdmin === "true" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => makeAdminMutation.mutate({ userId: user.id, makeAdmin: false })}
                            disabled={makeAdminMutation.isPending || isProtectedUser}
                            title={isProtectedUser ? "Cannot modify protected user" : ""}
                          >
                            Remove Admin
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => makeAdminMutation.mutate({ userId: user.id, makeAdmin: true })}
                            disabled={makeAdminMutation.isPending || isProtectedUser}
                            title={isProtectedUser ? "Cannot modify protected user" : ""}
                          >
                            Make Admin
                          </Button>
                        )}

                        {!isTerminated && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTerminateDialog({ open: true, username: user.username })}
                            disabled={isProtectedUser}
                            title={isProtectedUser ? "Cannot terminate protected user" : ""}
                          >
                            Terminate
                          </Button>
                        )}

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteDialog({ open: true, userId: user.id, username: user.username })}
                          disabled={deleteUserMutation.isPending || isProtectedUser}
                          title={isProtectedUser ? "Cannot delete protected user" : ""}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Username Management */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Blocked Users */}
          <Card>
            <CardHeader>
              <CardTitle>Blocked Users</CardTitle>
              <CardDescription>
                Users that cannot sign up.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Username to block..."
                    value={blockUsernameInput}
                    onChange={(e) => setBlockUsernameInput(e.target.value)}
                  />
                  <Button
                    onClick={() => blockUsernameMutation.mutate(blockUsernameInput)}
                    disabled={!blockUsernameInput || blockUsernameMutation.isPending}
                  >
                    Block
                  </Button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {blockedUsernames?.map((blocked: any) => (
                    <div key={blocked.id} className="flex items-center justify-between p-2 bg-slate-800 border border-slate-600 rounded">
                      <span className="font-mono text-white">{blocked.username}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => unblockUsernameMutation.mutate(blocked.username)}
                      >
                        Unblock
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Terminated Users */}
          <Card>
            <CardHeader>
              <CardTitle>Terminated Users</CardTitle>
              <CardDescription>
                Users that have been terminated from service
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {terminatedUsernames?.map((terminated: any) => (
                  <div key={terminated.id} className="flex items-center justify-between p-2 bg-red-900/20 border border-red-600 rounded">
                    <div>
                      <div className="font-mono text-white">{terminated.username}</div>
                      <div className="text-xs text-gray-300">
                        {format(new Date(terminated.terminatedAt), "MMM dd, yyyy")}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unterminateUsernameMutation.mutate(terminated.username)}
                    >
                      Restore
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete User Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete User</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              Are you sure you want to delete user "{deleteDialog.username}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserMutation.mutate(deleteDialog.userId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Terminate Username Dialog */}
      <AlertDialog open={terminateDialog.open} onOpenChange={(open) => setTerminateDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Terminate Username</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              Are you sure you want to terminate "{terminateDialog.username}"? This will mark them as terminated in the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => terminateUsernameMutation.mutate(terminateDialog.username)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Terminate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Rank Dialog */}
      <Dialog open={editRankDialog.open} onOpenChange={(open) => setEditRankDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Edit User Rank</DialogTitle>
            <DialogDescription className="text-slate-300">
              Update the rank for user "{editRankDialog.username}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-white">Current Rank:</label>
              <p className="text-slate-300">{editRankDialog.currentRank}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-white">New Rank:</label>
              <Input
                value={newRank}
                onChange={(e) => setNewRank(e.target.value)}
                placeholder="Enter new rank (e.g., Master Trooper, Sergeant)"
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setEditRankDialog({ open: false, userId: 0, username: "", currentRank: "" });
                setNewRank("");
              }}
              className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={() => updateRankMutation.mutate({ userId: editRankDialog.userId, rank: newRank })}
              disabled={updateRankMutation.isPending || !newRank.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {updateRankMutation.isPending ? "Updating..." : "Update Rank"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
