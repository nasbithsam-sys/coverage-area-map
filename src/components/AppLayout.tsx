import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MapPin, Users, Shield, LogOut, ChevronRight, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";

const navItems = [
{ path: "/dashboard", label: "Coverage Map", icon: MapPin, roles: ["marketing", "csr", "admin"] as const },
{ path: "/technicians", label: "Technicians", icon: Users, roles: ["csr", "admin"] as const },
{ path: "/admin", label: "Admin", icon: Shield, roles: ["admin"] as const }];


function SidebarContent({ role, user, signOut, visibleNav, location, onNavigate }: any) {
  return (
    <>
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

      <nav className="flex-1 p-3 space-y-1 mt-2 text-primary-foreground">
        {visibleNav.map((item: any) => {
          const active = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} onClick={onNavigate}>
              <div className={cn("nav-item", active && "active")}>
                <item.icon className="h-[18px] w-[18px]" />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight className="h-3.5 w-3.5 opacity-40" />}
              </div>
            </Link>);

        })}
      </nav>

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
          onClick={signOut}>

          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </Button>
      </div>
    </>);

}

export default function AppLayout({ children }: {children: React.ReactNode;}) {
  const { role, user, signOut } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const visibleNav = navItems.filter((item) => role && (item.roles as readonly string[]).includes(role));
  const sidebarProps = { role, user, signOut, visibleNav, location, onNavigate: () => setOpen(false) };

  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen w-full">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border glass-sidebar">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-sidebar-foreground">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[260px] p-0 glass-sidebar border-sidebar-border">
              <div className="flex flex-col h-full">
                <SidebarContent {...sidebarProps} />
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-sidebar-primary" />
            <span className="text-sm font-bold text-sidebar-foreground">TechMap</span>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-background">{children}</main>
      </div>);

  }

  return (
    <div className="flex min-h-screen w-full">
      <aside className="w-[260px] glass-sidebar border-r border-sidebar-border flex flex-col shrink-0">
        <SidebarContent {...sidebarProps} />
      </aside>
      <main className="flex-1 overflow-auto bg-background">{children}</main>
    </div>);

}