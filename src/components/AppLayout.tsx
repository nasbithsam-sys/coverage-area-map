import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { MapPin, Users, BarChart3, LogOut, Shield, Eye } from "lucide-react";
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
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-sidebar-background text-sidebar-foreground flex flex-col">
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-sidebar-primary" />
            <span className="text-lg font-bold">TechMap</span>
          </div>
          <p className="text-xs text-sidebar-foreground/60 mt-1 capitalize">{role} View</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {visibleNav.map((item) => (
            <Link key={item.path} to={item.path}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  location.pathname === item.path && "bg-sidebar-accent text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          <p className="text-xs text-sidebar-foreground/60 truncate px-3">{user?.email}</p>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
