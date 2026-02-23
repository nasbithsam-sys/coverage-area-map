import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { getSafeErrorMessage } from "@/lib/safeError";
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
import { Plus, Search, Pencil, Power, Trash2, X, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
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

type SortField = "name" | "city" | "state" | "service_radius_miles" | "priority";
type SortDir = "asc" | "desc";

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
  const [newTechFilter, setNewTechFilter] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [allSpecialties, setAllSpecialties] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

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

  const fetchTechs = useCallback(async () => {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("technicians")
      .select("*", { count: "exact" })
      .order(sortField, { ascending: sortDir === "asc" })
      .range(from, to);

    if (debouncedSearch.trim()) {
      const q = `%${debouncedSearch.trim()}%`;
      query = query.or(`name.ilike.${q},city.ilike.${q},state.ilike.${q},zip.ilike.${q}`);
    }

    if (specialtyFilter.length > 0) {
      query = query.overlaps("specialty", specialtyFilter);
    }

    if (newTechFilter) {
      query = query.eq("is_new", true);
    }

    const { data, count, error } = await query;
    if (error) {
      console.error("Fetch error:", error.message);
    }
    setTechnicians(data || []);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [page, debouncedSearch, specialtyFilter, newTechFilter, sortField, sortDir]);

  useEffect(() => { fetchTechs(); }, [fetchTechs]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(1);
  };

  const SortableHead = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground transition-colors group"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1.5">
        {children}
        <ArrowUpDown className={`h-3.5 w-3.5 transition-opacity ${sortField === field ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-50"}`} />
      </div>
    </TableHead>
  );

  const toggleActive = async (tech: Tables<"technicians">) => {
    const { error } = await supabase
      .from("technicians")
      .update({ is_active: !tech.is_active })
      .eq("id", tech.id);
    if (!error) {
      fetchTechs();
    }
  };

  const deleteTech = async (tech: Tables<"technicians">) => {
    const { error } = await supabase.from("technicians").delete().eq("id", tech.id);
    if (error) {
      toast({ title: "Error", description: getSafeErrorMessage(error), variant: "destructive" });
    } else {
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
        toast({ title: "Error", description: getSafeErrorMessage(error), variant: "destructive" });
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
      <motion.div
        className="p-4 md:p-6 space-y-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35 }}
          >
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Technicians</h1>
            <p className="text-muted-foreground text-sm">Manage your technician roster</p>
          </motion.div>
          <div className="flex items-center gap-2 flex-wrap">
            <TechImport technicians={technicians} onImported={fetchTechs} role={role} />
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingTech(null); }}>
              <DialogTrigger asChild>
                <Button className="gradient-btn rounded-xl">
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
              className="pl-9 rounded-xl bg-muted/30 border-border/50 focus:bg-card transition-colors"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
              <Badge
                variant={newTechFilter ? "default" : "outline"}
                className="cursor-pointer text-xs select-none transition-all duration-200 hover:scale-105"
                onClick={() => { setNewTechFilter((v) => !v); setPage(1); }}
              >
                🆕 New Tech
              </Badge>
              {allSpecialties.length > 0 && (
                <>
                  <span className="text-xs text-muted-foreground font-medium mx-1">|</span>
                  <span className="text-xs text-muted-foreground font-medium mr-1">Specialties:</span>
                  {allSpecialties.map((s) => (
                    <Badge
                      key={s}
                      variant={specialtyFilter.includes(s) ? "default" : "outline"}
                      className="cursor-pointer text-xs select-none transition-all duration-200 hover:scale-105"
                      onClick={() => toggleSpecialty(s)}
                    >
                      {s}
                    </Badge>
                  ))}
                </>
              )}
              {(specialtyFilter.length > 0 || newTechFilter) && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { setSpecialtyFilter([]); setNewTechFilter(false); setPage(1); }}>
                  <X className="h-3 w-3 mr-1" /> Clear
                </Button>
              )}
            </div>
        </div>

        {/* Bulk action bar */}
        <AnimatePresence>
          {someSelected && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-3 p-3 rounded-xl border bg-primary/5 border-primary/20 overflow-hidden"
            >
              <span className="text-sm font-semibold text-primary">{selectedIds.size} selected</span>
              <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="rounded-lg">
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
            </motion.div>
          )}
        </AnimatePresence>

        <div className="rounded-xl border border-border/50 overflow-hidden bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-10">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <SortableHead field="name">Name</SortableHead>
                <TableHead>Number</TableHead>
                <SortableHead field="city">Location</SortableHead>
                <TableHead>Specialties</TableHead>
                <SortableHead field="priority">Priority</SortableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                      <span className="text-sm">Loading...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : technicians.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No technicians found</p>
                  </TableCell>
                </TableRow>
              ) : technicians.map((tech) => (
                <TableRow
                  key={tech.id}
                  data-state={selectedIds.has(tech.id) ? "selected" : undefined}
                  className="group transition-colors hover:bg-muted/40"
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(tech.id)}
                      onCheckedChange={() => toggleOne(tech.id)}
                      aria-label={`Select ${tech.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-semibold">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {tech.name.charAt(0)}
                      </div>
                      <div>
                        <span className="group-hover:text-primary transition-colors">{tech.name}</span>
                        {tech.is_new && (
                          <Badge variant="default" className="ml-2 text-[10px] bg-accent hover:bg-accent/90 px-1.5 py-0">NEW</Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{tech.phone || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{tech.city}, {tech.state}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {tech.specialty?.map((s) => (
                        <Badge key={s} variant="secondary" className="text-[10px] rounded-md px-1.5 py-0">{s}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={(PRIORITY_COLORS[tech.priority] || "secondary") as any} className="text-[10px]">
                      {PRIORITY_LABELS[tech.priority] || "Normal"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className={`inline-flex items-center gap-1.5 text-xs font-medium ${tech.is_active ? "text-accent" : "text-muted-foreground"}`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${tech.is_active ? "bg-accent" : "bg-muted-foreground/40"}`} />
                      {tech.is_active ? "Active" : "Inactive"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        aria-label={`Edit ${tech.name}`}
                        onClick={() => { setEditingTech(tech); setDialogOpen(true); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" aria-label={`${tech.is_active ? "Deactivate" : "Activate"} ${tech.name}`} onClick={() => toggleActive(tech)}>
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:text-destructive" aria-label={`Delete ${tech.name}`}>
                            <Trash2 className="h-3.5 w-3.5" />
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
          <div className="flex items-center justify-between pt-1">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-lg" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <span className="text-sm font-medium px-2">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" className="rounded-lg" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </AppLayout>
  );
}
