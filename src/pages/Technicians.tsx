import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import TechForm from "@/components/TechForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Pencil, Power } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

export default function Technicians() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [technicians, setTechnicians] = useState<Tables<"technicians">[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTech, setEditingTech] = useState<Tables<"technicians"> | null>(null);

  const fetchTechs = async () => {
    const { data } = await supabase.from("technicians").select("*").order("name");
    setTechnicians(data || []);
  };

  useEffect(() => { fetchTechs(); }, []);

  const toggleActive = async (tech: Tables<"technicians">) => {
    const { error } = await supabase
      .from("technicians")
      .update({ is_active: !tech.is_active })
      .eq("id", tech.id);
    if (!error) {
      await logActivity(tech.is_active ? "deactivated" : "activated", "technician", tech.id, {
        name: tech.name,
      });
      fetchTechs();
    }
  };

  const logActivity = async (action: string, entity: string, entityId: string, details: Record<string, unknown>) => {
    if (!user) return;
    await supabase.from("activity_log").insert([{
      user_id: user.id,
      action_type: action,
      entity_type: entity,
      entity_id: entityId,
      details: details as unknown as import("@/integrations/supabase/types").Json,
    }]);
  };

  const handleSaved = () => {
    setDialogOpen(false);
    setEditingTech(null);
    fetchTechs();
  };

  const filtered = technicians.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.city.toLowerCase().includes(search.toLowerCase()) ||
      t.state.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Technicians</h1>
            <p className="text-muted-foreground">Manage your technician roster</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingTech(null); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Add Technician
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingTech ? "Edit Technician" : "Add Technician"}</DialogTitle>
              </DialogHeader>
              <TechForm
                tech={editingTech}
                onSaved={handleSaved}
                logActivity={logActivity}
              />
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Specialties</TableHead>
                <TableHead>Radius</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((tech) => (
                <TableRow key={tech.id}>
                  <TableCell className="font-medium">{tech.name}</TableCell>
                  <TableCell>{tech.city}, {tech.state}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {tech.specialty?.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{tech.service_radius_miles} mi</TableCell>
                  <TableCell>
                    <Badge variant={tech.is_active ? "default" : "outline"}>
                      {tech.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setEditingTech(tech); setDialogOpen(true); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => toggleActive(tech)}>
                        <Power className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No technicians found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
