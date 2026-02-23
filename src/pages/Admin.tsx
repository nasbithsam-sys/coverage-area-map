import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import CoverageZoneManager from "@/components/CoverageZoneManager";
import RoleManagement from "@/components/RoleManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import type { Tables, Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRole {
  user_id: string;
  role: AppRole;
  profile: { full_name: string | null; email: string | null; otp_code?: string | null; has_totp?: boolean } | null;
}

const CHART_COLORS = ["hsl(217, 71%, 45%)", "hsl(150, 60%, 40%)", "hsl(43, 96%, 56%)", "hsl(0, 72%, 51%)"];

export default function Admin() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [technicians, setTechnicians] = useState<Tables<"technicians">[]>([]);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const { data: profilesData } = await supabase.rpc("get_admin_profiles");
    const profileMap = new Map((profilesData || []).map(p => [p.user_id, p]));

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

        <Tabs defaultValue="analytics">
          <TabsList>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="coverage">Coverage Zones</TabsTrigger>
            <TabsTrigger value="roles">Role Management</TabsTrigger>
          </TabsList>

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
            <RoleManagement users={users} onRefresh={fetchAll} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
