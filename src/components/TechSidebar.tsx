import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Search, X, Phone, Mail, MapPin } from "lucide-react";
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
    <aside className="w-80 border-l bg-card flex flex-col">
      {selectedTech ? (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">{selectedTech.name}</h3>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {selectedTech.city}, {selectedTech.state} {selectedTech.zip}
            </div>
            {selectedTech.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                {selectedTech.phone}
              </div>
            )}
            {selectedTech.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                {selectedTech.email}
              </div>
            )}
            <div>
              <span className="text-muted-foreground text-xs">Service Radius</span>
              <p className="font-medium">{selectedTech.service_radius_miles} miles</p>
            </div>
            {selectedTech.specialty && selectedTech.specialty.length > 0 && (
              <div>
                <span className="text-muted-foreground text-xs">Specialties</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedTech.specialty.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {selectedTech.notes && (
              <div>
                <span className="text-muted-foreground text-xs">Notes</span>
                <p className="text-sm">{selectedTech.notes}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search technicians..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filtered.map((tech) => (
                <button
                  key={tech.id}
                  onClick={() => onSelect(tech)}
                  className="w-full text-left p-3 rounded-md hover:bg-accent/10 transition-colors"
                >
                  <p className="font-medium text-sm">{tech.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {tech.city}, {tech.state}
                  </p>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">No technicians found</p>
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </aside>
  );
}
