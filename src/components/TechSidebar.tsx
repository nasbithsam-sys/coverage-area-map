import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Search, X, Phone, Mail, MapPin, Wrench, Navigation, Crosshair, AlertTriangle, Sparkles } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import type { SearchResultItem } from "@/components/USMap";

interface Props {
  technicians: Tables<"technicians">[];
  selectedTech: Tables<"technicians"> | null;
  onSelect: (tech: Tables<"technicians">) => void;
  onClose: () => void;
  searchResults?: SearchResultItem[] | null;
  searchResultType?: string | null;
  searchQuery?: string | null;
  onLocateTech?: (tech: Tables<"technicians">) => void;
  onClearSearch?: () => void;
}

interface SpecialtyGroup {
  label: string;
  items: SearchResultItem[];
  isNew?: boolean;
}

function TechAccordionEntry({
  item,
  onLocateTech,
}: {
  item: SearchResultItem;
  onLocateTech?: (tech: Tables<"technicians">) => void;
}) {
  return (
    <AccordionItem value={item.tech.id} className="border-b-0">
      <div className="flex items-center gap-1 px-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => onLocateTech?.(item.tech)}
          title="Locate on map"
        >
          <Crosshair className="h-3.5 w-3.5 text-primary" />
        </Button>

        <AccordionTrigger className="flex-1 py-2.5 hover:no-underline">
          <div className="flex items-center gap-2 min-w-0 text-left">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
              {item.tech.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-sm truncate">{item.tech.name}</p>
                {item.tech.is_new && (
                  <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 shrink-0 bg-accent hover:bg-accent/90">
                    NEW
                  </Badge>
                )}
                <Badge
                  variant={item.tech.is_active ? "default" : "secondary"}
                  className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                >
                  {item.tech.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="truncate">
                  {item.tech.city}, {item.tech.state} {item.tech.zip}
                </span>
                <span className="shrink-0 font-medium text-primary">
                  {item.distanceMiles.toFixed(1)} mi
                </span>
              </div>
            </div>
          </div>
        </AccordionTrigger>
      </div>

      <AccordionContent className="pl-10 pr-2 pb-3">
        <div className="space-y-2.5">
          {item.tech.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{item.tech.phone}</span>
            </div>
          )}
          {item.tech.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate">{item.tech.email}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Navigation className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{item.tech.service_radius_miles} mile radius</span>
          </div>
          {item.tech.specialty && item.tech.specialty.length > 0 && (
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Specialties</p>
              <div className="flex flex-wrap gap-1">
                {item.tech.specialty.map((s) => (
                  <Badge key={s} variant="secondary" className="text-[10px] rounded px-1.5 py-0.5">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {item.tech.notes && (
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{item.tech.notes}</p>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export default function TechSidebar({
  technicians,
  selectedTech,
  onSelect,
  onClose,
  searchResults,
  searchResultType,
  searchQuery,
  onLocateTech,
  onClearSearch,
}: Props) {
  const [search, setSearch] = useState("");

  const filtered = technicians.filter(
    (t) =>
      t.is_active &&
      (t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.city.toLowerCase().includes(search.toLowerCase()) ||
        t.state.toLowerCase().includes(search.toLowerCase()))
  );

  const hasFallback = searchResults?.some((r) => r.isFallback) ?? false;
  const isSearchMode = searchResults && searchResults.length > 0;

  // Compute specialty groups for search results
  const specialtyGroups = useMemo<SpecialtyGroup[]>(() => {
    if (!searchResults || searchResults.length === 0) return [];

    const newTechs: SearchResultItem[] = [];
    const bySpecialty: Record<string, SearchResultItem[]> = {};
    const other: SearchResultItem[] = [];
    const seenInNew = new Set<string>();

    // First pass: collect new techs
    for (const item of searchResults) {
      if (item.tech.is_new) {
        newTechs.push(item);
        seenInNew.add(item.tech.id);
      }
    }

    // Second pass: group by specialty (including new techs under their specialties too)
    for (const item of searchResults) {
      const specialties = item.tech.specialty;
      if (specialties && specialties.length > 0) {
        for (const s of specialties) {
          if (!bySpecialty[s]) bySpecialty[s] = [];
          bySpecialty[s].push(item);
        }
      } else if (!seenInNew.has(item.tech.id)) {
        other.push(item);
      }
    }

    // Sort each group by distance
    const sortByDist = (a: SearchResultItem, b: SearchResultItem) => a.distanceMiles - b.distanceMiles;
    newTechs.sort(sortByDist);
    other.sort(sortByDist);

    const groups: SpecialtyGroup[] = [];

    if (newTechs.length > 0) {
      groups.push({ label: "New Technicians", items: newTechs, isNew: true });
    }

    // Alphabetical specialty groups
    const sortedKeys = Object.keys(bySpecialty).sort();
    for (const key of sortedKeys) {
      bySpecialty[key].sort(sortByDist);
      groups.push({ label: key, items: bySpecialty[key] });
    }

    if (other.length > 0) {
      groups.push({ label: "Other", items: other });
    }

    return groups;
  }, [searchResults]);

  // Selected tech detail view
  if (selectedTech && !isSearchMode) {
    return (
      <aside className="w-full md:w-80 border-l-0 md:border-l border-border/50 bg-card/50 backdrop-blur-sm flex flex-col h-full">
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
      </aside>
    );
  }

  // Search results mode — grouped by specialty
  if (isSearchMode) {
    return (
      <aside className="w-full md:w-80 border-l-0 md:border-l border-border/50 bg-card/50 backdrop-blur-sm flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-sm tracking-tight">
              Search Results
              <span className="ml-1.5 text-muted-foreground font-normal">({searchResults.length})</span>
            </h3>
            <Button variant="ghost" size="sm" onClick={onClearSearch} className="h-7 px-2 text-xs">
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          </div>
          {searchQuery && (
            <p className="text-xs text-muted-foreground truncate">
              {searchResultType === "state" ? "State" : searchResultType === "city" ? "City" : searchResultType === "zip" ? "ZIP" : searchResultType === "neighborhood" ? "Neighborhood" : "Location"}
              : "{searchQuery}"
            </p>
          )}
        </div>

        {/* Fallback banner */}
        {hasFallback && (
          <div className="mx-4 mt-3 p-2.5 rounded-lg bg-muted/60 border border-border/50 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              No exact matches found. Showing nearest technicians.
            </p>
          </div>
        )}

        {/* Grouped results */}
        <ScrollArea className="flex-1">
          <div className="py-2">
            {specialtyGroups.map((group) => (
              <div key={group.label} className="mb-3">
                {/* Group heading */}
                <div className="flex items-center gap-2 px-4 py-2 sticky top-0 bg-card/90 backdrop-blur-sm z-10">
                  {group.isNew ? (
                    <Sparkles className="h-3.5 w-3.5 text-accent shrink-0" />
                  ) : (
                    <Wrench className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${group.isNew ? "text-accent" : "text-muted-foreground"}`}>
                    {group.label}
                  </h4>
                  <span className="text-[10px] text-muted-foreground font-medium">({group.items.length})</span>
                </div>

                {/* Techs in this group */}
                <Accordion type="single" collapsible className="px-2">
                  {group.items.map((item) => (
                    <TechAccordionEntry
                      key={`${group.label}-${item.tech.id}`}
                      item={item}
                      onLocateTech={onLocateTech}
                    />
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>
    );
  }

  // Default mode
  return (
    <aside className="w-full md:w-80 border-l-0 md:border-l border-border/50 bg-card/50 backdrop-blur-sm flex flex-col h-full">
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
    </aside>
  );
}