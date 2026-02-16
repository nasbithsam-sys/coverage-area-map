import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { MapPin, Users, Shield, LogOut, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/dashboard", label: "Coverage Map", icon: MapPin, roles: ["marketing", "csr", "admin"] as const },
  { path: "/technicians", label: "Technicians", icon: Users, roles: ["csr", "admin"] as const },
  { path: "/admin", label: "Admin", icon: Shield, roles: ["admin"] as const },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { role, user, signOut } = useAuth();
  const location = useLocation();

  const visibleNav = navItems.filter((item) => role && (item.roles as readonly string[]).includes(role));

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar */}
      <aside className="w-[260px] glass-sidebar border-r border-sidebar-border flex flex-col shrink-0">
        {/* Logo */}
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary/20">
              <MapPin className="h-5 w-5 text-sidebar-primary" />
            </div>
            <div>
              <span className="text-base font-bold text-sidebar-foreground tracking-tight">TechMap</span>
              <p className="text-[11px] text-sidebar-foreground/40 font-medium uppercase tracking-wider">{role} View</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 mt-2">
          {visibleNav.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
                <div className={cn("nav-item", active && "active")}>
                  <item.icon className="h-[18px] w-[18px]" />
                  <span className="flex-1">{item.label}</span>
                  {active && <ChevronRight className="h-3.5 w-3.5 opacity-40" />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-lg bg-sidebar-accent flex items-center justify-center text-xs font-bold text-sidebar-primary uppercase">
              {user?.email?.charAt(0) || "U"}
            </div>
            <p className="text-xs text-sidebar-foreground/60 truncate flex-1">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent text-xs h-8"
            onClick={signOut}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-background">{children}</main>
    </div>
  );
}
