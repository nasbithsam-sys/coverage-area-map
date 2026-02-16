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
  profile: { full_name: string | null; email: string | null } | null;
}

const CHART_COLORS = ["hsl(217, 71%, 45%)", "hsl(150, 60%, 40%)", "hsl(43, 96%, 56%)", "hsl(0, 72%, 51%)"];

export default function Admin() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [technicians, setTechnicians] = useState<Tables<"technicians">[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("csr");

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const { data: actData } = await supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    
    const { data: profilesData } = await supabase.from("profiles").select("user_id, full_name, email");
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

  const inviteUser = async () => {
    if (!inviteEmail) return;
    const { data, error } = await supabase.auth.signUp({
      email: inviteEmail,
      password: crypto.randomUUID().slice(0, 12),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    if (data.user) {
      await supabase.from("user_roles").insert({ user_id: data.user.id, role: inviteRole });
      toast({ title: "User invited", description: `${inviteEmail} added as ${inviteRole}` });
      setInviteEmail("");
      fetchAll();
    }
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
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
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
                          <Badge variant="outline">{a.action_type}</Badge>{" "}
                          {a.entity_type}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a.details && typeof a.details === "object" && "name" in a.details
                            ? String(a.details.name)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(a.created_at), "MMM d, yyyy h:mm a")}
                        </TableCell>
                      </TableRow>
                    ))}
                    {activities.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No activity yet
                        </TableCell>
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
                <CardHeader>
                  <CardTitle>Technicians by State (Top 10)</CardTitle>
                </CardHeader>
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
                <CardHeader>
                  <CardTitle>Active vs Inactive</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i]} />
                        ))}
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
              <CardHeader>
                <CardTitle>Invite User</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 items-end">
                  <div className="flex-1 space-y-2">
                    <Label>Email</Label>
                    <Input
                      placeholder="user@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="w-40 space-y-2">
                    <Label>Role</Label>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="csr">CSR</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={inviteUser}>Invite</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Users & Roles</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Change Role</TableHead>
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
                          {u.user_id !== user?.id ? (
                            <Select
                              value={u.role}
                              onValueChange={(v) => changeRole(u.user_id, v as AppRole)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
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
