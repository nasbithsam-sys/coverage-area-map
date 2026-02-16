import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Search, X, Phone, Mail, MapPin, Wrench, Navigation } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  technicians: Tables<"technicians">[];
  selectedTech: Tables<"technicians"> | null;
  onSelect: (tech: Tables<"technicians">) => void;
  onClose: () => void;
}

export default function TechSidebar({ technicians, selectedTech, onSelect, onClose }: Props) {
  const [search, setSearch] = useState("");

  const filtered = technicians.filter(
    (t) =>
      t.is_active &&
      (t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.city.toLowerCase().includes(search.toLowerCase()) ||
        t.state.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <aside className="w-full md:w-80 border-l-0 md:border-l border-border/50 bg-card/50 backdrop-blur-sm flex flex-col h-full">
      {selectedTech ? (
        <div className="p-5 space-y-5 animate-fade-in">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-lg tracking-tight">{selectedTech.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {selectedTech.city}, {selectedTech.state} {selectedTech.zip}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-lg">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4">
            {selectedTech.phone && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Phone</p>
                  <p className="text-sm font-medium">{selectedTech.phone}</p>
                </div>
              </div>
            )}
            {selectedTech.email && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Email</p>
                  <p className="text-sm font-medium truncate">{selectedTech.email}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                <Navigation className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Service Radius</p>
                <p className="text-sm font-bold">{selectedTech.service_radius_miles} miles</p>
              </div>
            </div>
            {selectedTech.specialty && selectedTech.specialty.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Wrench className="h-3 w-3" /> Specialties
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTech.specialty.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs rounded-lg font-medium px-2.5 py-1">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {selectedTech.notes && (
              <div className="p-3 rounded-xl bg-muted/40">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                <p className="text-sm leading-relaxed">{selectedTech.notes}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="p-4 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search technicians..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-muted/30 border-border/50"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              {filtered.map((tech) => (
                <button
                  key={tech.id}
                  onClick={() => onSelect(tech)}
                  className="w-full text-left p-3 rounded-xl hover:bg-muted/50 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {tech.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{tech.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {tech.city}, {tech.state}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-12">
                  <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No technicians found</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </aside>
  );
}
