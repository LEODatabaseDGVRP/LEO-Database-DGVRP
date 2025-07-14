import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, Shield, ShieldCheck, Trash2, ArrowLeft, Search } from "lucide-react";
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
} from "@/components/ui/alert-dialog";

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
        throw new Error("Failed to fetch blocked usernames");
      }
      return response.json();
    },
  });

  const { data: terminatedUsernames, refetch: refetchTerminated } = useQuery({
    queryKey: ["/api/admin/terminated-usernames"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/terminated-usernames");
      if (!response.ok) {
        throw new Error("Failed to fetch terminated usernames");
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
      toast({
        title: "✅ User Deleted",
        description: "User has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Delete Failed",
        description: error.message || "Failed to delete user.",
        variant: "destructive",
      });
    },
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: number; isAdmin: boolean }) => {
      const response = await apiRequest("PUT", `/api/admin/users/${userId}/admin`, { isAdmin });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update admin status");
      }
      return response.json();
    },
    onSuccess: (data, { userId, isAdmin }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "✅ Admin Status Updated",
        description: `User ${isAdmin ? "granted" : "revoked"} admin access.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Update Failed",
        description: error.message || "Failed to update admin status.",
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
    onSuccess: (data, username) => {
      refetchBlocked();
      setBlockUsernameInput("");
      toast({
        title: "✅ Username Blocked",
        description: `Username "${username}" is now blocked from registration.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Block Failed",
        description: error.message || "Failed to block username.",
        variant: "destructive",
      });
    },
  });

  const unblockUsernameMutation = useMutation({
    mutationFn: async (username: string) => {
      const response = await apiRequest("DELETE", `/api/admin/blocked-usernames/${username}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to unblock username");
      }
      return response.json();
    },
    onSuccess: (data, username) => {
      refetchBlocked();
      toast({
        title: "✅ Username Unblocked",
        description: `Username "${username}" is now available for registration.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Unblock Failed",
        description: error.message || "Failed to unblock username.",
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
    onSuccess: (data, username) => {
      refetchTerminated();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "✅ Username Terminated",
        description: `Username "${username}" has been terminated and cannot be used.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Terminate Failed",
        description: error.message || "Failed to terminate username.",
        variant: "destructive",
      });
    },
  });

  const unterminateUsernameMutation = useMutation({
    mutationFn: async (username: string) => {
      const response = await apiRequest("DELETE", `/api/admin/terminated-usernames/${username}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to unterminate username");
      }
      return response.json();
    },
    onSuccess: (data, username) => {
      refetchTerminated();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "✅ Username Unterminated",
        description: `Username "${username}" is now available for use.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Unterminate Failed",
        description: error.message || "Failed to unterminate username.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteUser = (userId: number, username: string) => {
    setDeleteDialog({ open: true, userId, username });
  };

  const confirmDeleteUser = () => {
    deleteUserMutation.mutate(deleteDialog.userId);
    setDeleteDialog({ open: false, userId: 0, username: "" });
  };

  const handleToggleAdmin = (userId: number, currentIsAdmin: string) => {
    const newIsAdmin = currentIsAdmin !== "true";
    toggleAdminMutation.mutate({ userId, isAdmin: newIsAdmin });
  };

  const handleTerminateUsername = (username: string) => {
    setTerminateDialog({ open: true, username });
  };

  const confirmTerminateUser = () => {
    terminateUsernameMutation.mutate(terminateDialog.username);
    setTerminateDialog({ open: false, username: "" });
  };

  const handleBlockUsername = () => {
    if (blockUsernameInput.trim()) {
      blockUsernameMutation.mutate(blockUsernameInput.trim());
    }
  };

  // Helper function to check if user actions should be disabled
  const isUserProtected = (user: User, currentUserId: number) => {
    return user.username.toLowerCase() === "popfork1" || user.id === currentUserId;
  };

  if (error) {
    return (
      <div className="min-h-screen p-4" style={{ backgroundColor: "var(--law-primary)" }}>
        <div className="max-w-4xl mx-auto">
          <Card className="law-card">
            <CardContent className="p-6">
              <div className="text-center">
                <Shield className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
                <p className="text-gray-300">You don't have permission to access the admin panel.</p>
                <Link href="/">
                  <Button className="mt-4 law-accent-btn">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Selection
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: "var(--law-primary)" }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Shield className="h-8 w-8 text-purple-400" />
            <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
          </div>
          <Link href="/">
            <Button variant="outline" className="law-input border-slate-600 text-white">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Selection
            </Button>
          </Link>
        </div>

        <div className="grid gap-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="law-card">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <Users className="h-8 w-8 text-blue-400" />
                  <div>
                    <p className="text-sm text-gray-400">Total Users</p>
                    <p className="text-2xl font-bold text-white">
                      {isLoading ? "..." : users?.length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="law-card">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <ShieldCheck className="h-8 w-8 text-green-400" />
                  <div>
                    <p className="text-sm text-gray-400">Citations Issued</p>
                    <p className="text-2xl font-bold text-white">
                      {stats?.citations || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="law-card">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <Users className="h-8 w-8 text-yellow-400" />
                  <div>
                    <p className="text-sm text-gray-400">Arrest Reports</p>
                    <p className="text-2xl font-bold text-white">
                      {stats?.arrests || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* User Management */}
          <Card className="law-card">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Users className="h-5 w-5 mr-2" />
                User Management
              </CardTitle>
              <CardDescription className="text-gray-300">
                Manage user accounts and permissions
              </CardDescription>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search users by username or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="law-input pl-10 border-slate-600 text-white placeholder-gray-400"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="text-white">Loading users...</div>
                </div>
              ) : filteredUsers?.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">
                    {searchTerm ? "No users found matching your search" : "No users found"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredUsers?.map((user: User) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border border-slate-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold">
                            {user.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-white font-medium">{user.username}</h3>
                          <p className="text-sm text-gray-400">ID: {user.id}</p>
                        </div>
                        {user.isAdmin === "true" && (
                          <Badge className="bg-green-600 text-white">Admin</Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {isUsernameTerminated(user.username) ? (
                          // Show only unterminate button for terminated users
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => unterminateUsernameMutation.mutate(user.username)}
                            disabled={unterminateUsernameMutation.isPending}
                            className="law-input border-green-600 text-green-400 hover:bg-green-600 hover:text-white"
                          >
                            <ShieldCheck className="h-4 w-4 mr-1" />
                            Unterminate
                          </Button>
                        ) : (
                          // Show all buttons for non-terminated users
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleAdmin(user.id, user.isAdmin)}
                              disabled={toggleAdminMutation.isPending || isUserProtected(user, currentUser?.user?.id)}
                              className="law-input border-slate-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {user.isAdmin === "true" ? (
                                <>
                                  <Shield className="h-4 w-4 mr-1" />
                                  Remove Admin
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="h-4 w-4 mr-1" />
                                  Make Admin
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTerminateUsername(user.username)}
                              disabled={terminateUsernameMutation.isPending || user.username.toLowerCase() === "popfork1"}
                              className="law-input border-orange-600 text-orange-400 hover:bg-orange-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Shield className="h-4 w-4 mr-1" />
                              Terminate
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteUser(user.id, user.username)}
                              disabled={deleteUserMutation.isPending || isUserProtected(user, currentUser?.user?.id)}
                              className="disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                  }
                </div>
              )}
            </CardContent>
          </Card>

          {/* Blocked Usernames Management */}
          <Card className="law-card">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Blocked Usernames
              </CardTitle>
              <CardDescription className="text-gray-300">
                Manage usernames that are blocked from registration
              </CardDescription>
              <div className="mt-4 flex space-x-2">
                <Input
                  placeholder="Enter username to block..."
                  value={blockUsernameInput}
                  onChange={(e) => setBlockUsernameInput(e.target.value)}
                  className="law-input border-slate-600 text-white placeholder-gray-400"
                  onKeyPress={(e) => e.key === 'Enter' && handleBlockUsername()}
                />
                <Button
                  onClick={handleBlockUsername}
                  disabled={blockUsernameMutation.isPending || !blockUsernameInput.trim()}
                  className="law-accent-btn text-white"
                >
                  <Shield className="h-4 w-4 mr-1" />
                  Block
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {blockedUsernames?.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">No blocked usernames</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {blockedUsernames?.map((blocked: any) => (
                    <div key={blocked.id} className="flex items-center justify-between p-4 border border-slate-700 rounded-lg">
                      <div>
                        <h3 className="text-white font-medium">{blocked.username}</h3>
                        <p className="text-sm text-gray-400">
                          Blocked: {new Date(blocked.deletedAt).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => unblockUsernameMutation.mutate(blocked.username)}
                        disabled={unblockUsernameMutation.isPending}
                        className="law-input border-slate-600 text-white"
                      >
                        <ShieldCheck className="h-4 w-4 mr-1" />
                        Unblock
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Terminated Usernames Management */}
          <Card className="law-card">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Shield className="h-5 w-5 mr-2 text-red-400" />
                Terminated Usernames
              </CardTitle>
              <CardDescription className="text-gray-300">
                Manage usernames that are terminated and cannot be used for login or registration
              </CardDescription>
            </CardHeader>
            <CardContent>
              {terminatedUsernames?.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">No terminated usernames</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {terminatedUsernames?.map((terminated: any) => (
                    <div key={terminated.id} className="flex items-center justify-between p-4 border border-red-700 rounded-lg">
                      <div>
                        <h3 className="text-white font-medium">{terminated.username}</h3>
                        <p className="text-sm text-gray-400">
                          Terminated: {new Date(terminated.terminatedAt).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => unterminateUsernameMutation.mutate(terminated.username)}
                        disabled={unterminateUsernameMutation.isPending}
                        className="law-input border-green-600 text-green-400 hover:bg-green-600 hover:text-white"
                      >
                        <ShieldCheck className="h-4 w-4 mr-1" />
                        Unterminate
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent className="law-card border-slate-600">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete User</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              Are you sure you want to delete user "{deleteDialog.username}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-600 hover:bg-slate-500 text-white border-slate-500">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteUser}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Terminate Confirmation Dialog */}
      <AlertDialog open={terminateDialog.open} onOpenChange={(open) => setTerminateDialog({ ...terminateDialog, open })}>
        <AlertDialogContent className="law-card border-slate-600">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Terminate Username</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              Are you sure you want to terminate username "{terminateDialog.username}"? This will prevent login and account creation with this username.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-600 hover:bg-slate-500 text-white border-slate-500">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmTerminateUser}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              Terminate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}