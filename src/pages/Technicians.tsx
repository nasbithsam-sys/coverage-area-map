import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import TechForm from "@/components/TechForm";
import TechImport from "@/components/TechImport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Power, Trash2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

const PRIORITY_COLORS: Record<string, string> = {
  best: "default",
  normal: "secondary",
  last: "outline",
};

const PRIORITY_LABELS: Record<string, string> = {
  best: "⭐ Best",
  normal: "Normal",
  last: "Last",
};

const PAGE_SIZE = 50;

export default function Technicians() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [technicians, setTechnicians] = useState<Tables<"technicians">[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTech, setEditingTech] = useState<Tables<"technicians"> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [specialtyFilter, setSpecialtyFilter] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // All specialties fetched once for the filter bar
  const [allSpecialties, setAllSpecialties] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search input
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Fetch specialties once for filter bar
  useEffect(() => {
    async function fetchSpecialties() {
      const { data } = await supabase
        .from("technicians")
        .select("specialty")
        .not("specialty", "is", null);
      if (data) {
        const set = new Set<string>();
        data.forEach((t: any) => t.specialty?.forEach((s: string) => set.add(s)));
        setAllSpecialties(Array.from(set).sort());
      }
    }
    fetchSpecialties();
  }, []);

  // Server-side paginated fetch
  const fetchTechs = useCallback(async () => {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("technicians")
      .select("*", { count: "exact" })
      .order("name")
      .range(from, to);

    // Server-side search filter
    if (debouncedSearch.trim()) {
      const q = `%${debouncedSearch.trim()}%`;
      query = query.or(`name.ilike.${q},city.ilike.${q},state.ilike.${q},zip.ilike.${q}`);
    }

    // Server-side specialty filter
    if (specialtyFilter.length > 0) {
      query = query.overlaps("specialty", specialtyFilter);
    }

    const { data, count, error } = await query;
    if (error) {
      console.error("Fetch error:", error.message);
    }
    setTechnicians(data || []);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [page, debouncedSearch, specialtyFilter]);

  useEffect(() => { fetchTechs(); }, [fetchTechs]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

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

  const deleteTech = async (tech: Tables<"technicians">) => {
    const { error } = await supabase.from("technicians").delete().eq("id", tech.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      await logActivity("deleted", "technician", tech.id, { name: tech.name });
      toast({ title: "Technician removed" });
      fetchTechs();
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    const BATCH_SIZE = 50;
    let hasError = false;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("technicians").delete().in("id", batch);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        hasError = true;
        break;
      }
    }
    if (!hasError) {
      toast({ title: `${ids.length} technician(s) removed` });
      setSelectedIds(new Set());
      fetchTechs();
    }
    setBulkDeleteOpen(false);
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

  const toggleSpecialty = (s: string) => {
    setSpecialtyFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
    setPage(1);
  };

  // Selection helpers — only for current page
  const allPageSelected = technicians.length > 0 && technicians.every((t) => selectedIds.has(t.id));
  const someSelected = selectedIds.size > 0;

  const toggleAll = () => {
    if (allPageSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(technicians.map((t) => t.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Technicians</h1>
            <p className="text-muted-foreground">Manage your technician roster</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <TechImport technicians={technicians} onImported={fetchTechs} role={role} />
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
        </div>

        {/* Search + Specialty Filter */}
        <div className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
             <Input
              aria-label="Search technicians"
              placeholder="Search by name, city, state, ZIP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {allSpecialties.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-muted-foreground font-medium mr-1">Specialties:</span>
              {allSpecialties.map((s) => (
                <Badge
                  key={s}
                  variant={specialtyFilter.includes(s) ? "default" : "outline"}
                  className="cursor-pointer text-xs select-none"
                  onClick={() => toggleSpecialty(s)}
                >
                  {s}
                </Badge>
              ))}
              {specialtyFilter.length > 0 && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { setSpecialtyFilter([]); setPage(1); }}>
                  <X className="h-3 w-3 mr-1" /> Clear
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Bulk action bar */}
        {someSelected && (
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50 animate-fade-in">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-1" /> Delete Selected
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selectedIds.size} technician(s)?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove the selected technicians. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={bulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Clear selection
            </Button>
          </div>
        )}

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Specialties</TableHead>
                <TableHead>Radius</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : technicians.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No technicians found
                  </TableCell>
                </TableRow>
              ) : technicians.map((tech) => (
                <TableRow key={tech.id} data-state={selectedIds.has(tech.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(tech.id)}
                      onCheckedChange={() => toggleOne(tech.id)}
                      aria-label={`Select ${tech.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {tech.name}
                    {tech.is_new && (
                      <Badge variant="default" className="ml-2 text-xs bg-green-600 hover:bg-green-700">NEW</Badge>
                    )}
                  </TableCell>
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
                    <Badge variant={(PRIORITY_COLORS[tech.priority] || "secondary") as any}>
                      {PRIORITY_LABELS[tech.priority] || "Normal"}
                    </Badge>
                  </TableCell>
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
                        aria-label={`Edit ${tech.name}`}
                        onClick={() => { setEditingTech(tech); setDialogOpen(true); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`${tech.is_active ? "Deactivate" : "Activate"} ${tech.name}`} onClick={() => toggleActive(tech)}>
                        <Power className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Delete ${tech.name}`} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove {tech.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete this technician. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteTech(tech)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <span className="text-sm font-medium">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
