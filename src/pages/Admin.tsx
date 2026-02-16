import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import CoverageZoneManager from "@/components/CoverageZoneManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format } from "date-fns";
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import type { Tables, Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface ActivityRow {
  id: string;
  action_type: string;
  entity_type: string;
  details: Record<string, unknown> | null;
  created_at: string;
  user_id: string;
  profile?: { full_name: string | null; email: string | null } | null;
}

interface UserWithRole {
  user_id: string;
  role: AppRole;
  profile: { full_name: string | null; email: string | null; otp_code?: string | null } | null;
}

const CHART_COLORS = ["hsl(217, 71%, 45%)", "hsl(150, 60%, 40%)", "hsl(43, 96%, 56%)", "hsl(0, 72%, 51%)"];

export default function Admin() {
  const { toast } = useToast();
  const { user, session } = useAuth();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [technicians, setTechnicians] = useState<Tables<"technicians">[]>([]);
  const [visibleOtps, setVisibleOtps] = useState<Set<string>>(new Set());

  // Create user form
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("csr");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const { data: actData } = await supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: profilesData } = await supabase.from("profiles").select("user_id, full_name, email, otp_code");
    const profileMap = new Map((profilesData || []).map(p => [p.user_id, p]));

    setActivities(
      (actData || []).map(a => ({
        ...a,
        details: a.details as Record<string, unknown> | null,
        profile: profileMap.get(a.user_id) || null,
      }))
    );

    const { data: roleData } = await supabase.from("user_roles").select("user_id, role");
    setUsers(
      (roleData || []).map(r => ({
        ...r,
        profile: profileMap.get(r.user_id) || null,
      }))
    );

    const { data: techData } = await supabase.from("technicians").select("*");
    setTechnicians(techData || []);
  };

  const changeRole = async (userId: string, newRole: AppRole) => {
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole })
      .eq("user_id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Role updated" });
      fetchAll();
    }
  };

  const createUser = async () => {
    if (!newEmail || !newPassword || !newFullName) {
      toast({ title: "All fields required", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            email: newEmail,
            password: newPassword,
            fullName: newFullName,
            role: newRole,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({
        title: "User created",
        description: `${newEmail} added as ${newRole}. OTP: ${data.otp_code}`,
      });
      setNewEmail("");
      setNewPassword("");
      setNewFullName("");
      fetchAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const regenerateOtp = async (userId: string) => {
    const newOtp = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
    const { error } = await supabase
      .from("profiles")
      .update({ otp_code: newOtp })
      .eq("user_id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "OTP regenerated", description: `New code: ${newOtp}` });
      fetchAll();
    }
  };

  const toggleOtpVisibility = (userId: string) => {
    setVisibleOtps(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const copyOtp = (otp: string) => {
    navigator.clipboard.writeText(otp);
    toast({ title: "Copied to clipboard" });
  };

  const techsByState = Object.entries(
    technicians.reduce<Record<string, number>>((acc, t) => {
      if (t.is_active) acc[t.state] = (acc[t.state] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const activeCount = technicians.filter((t) => t.is_active).length;
  const inactiveCount = technicians.length - activeCount;
  const pieData = [
    { name: "Active", value: activeCount },
    { name: "Inactive", value: inactiveCount },
  ];

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>

        <Tabs defaultValue="activity">
          <TabsList>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="coverage">Coverage Zones</TabsTrigger>
            <TabsTrigger value="roles">Role Management</TabsTrigger>
          </TabsList>

          {/* Activity Log */}
          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activities.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.profile?.full_name || a.profile?.email || "Unknown"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{a.action_type}</Badge> {a.entity_type}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a.details && typeof a.details === "object" && "name" in a.details ? String(a.details.name) : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(a.created_at), "MMM d, yyyy h:mm a")}
                        </TableCell>
                      </TableRow>
                    ))}
                    {activities.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No activity yet</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Technicians by State (Top 10)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={techsByState}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="state" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(217, 71%, 45%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Active vs Inactive</CardTitle></CardHeader>
                <CardContent className="flex justify-center">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label>
                        {pieData.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i]} />))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Coverage Zones */}
          <TabsContent value="coverage" className="space-y-4">
            <CoverageZoneManager />
          </TabsContent>

          {/* Role Management */}
          <TabsContent value="roles" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Create User</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input placeholder="John Doe" value={newFullName} onChange={(e) => setNewFullName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input placeholder="user@company.com" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input placeholder="Set password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="csr">CSR</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button className="mt-4" onClick={createUser} disabled={creating}>
                  {creating ? "Creating..." : "Create User"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Users & Roles</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>OTP Code</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.user_id}>
                        <TableCell>{u.profile?.full_name || "—"}</TableCell>
                        <TableCell>{u.profile?.email || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">{u.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                              {visibleOtps.has(u.user_id)
                                ? (u.profile?.otp_code || "—")
                                : "••••••"}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => toggleOtpVisibility(u.user_id)}
                            >
                              {visibleOtps.has(u.user_id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </Button>
                            {visibleOtps.has(u.user_id) && u.profile?.otp_code && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => copyOtp(u.profile!.otp_code!)}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => regenerateOtp(u.user_id)}
                              title="Regenerate OTP"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {u.user_id !== user?.id ? (
                            <Select value={u.role} onValueChange={(v) => changeRole(u.user_id, v as AppRole)}>
                              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="marketing">Marketing</SelectItem>
                                <SelectItem value="csr">CSR</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm text-muted-foreground">You</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
