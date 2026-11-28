import { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import Avatar from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LayoutDashboard, CalendarDays, Settings, ArrowLeft, Ticket, ScanLine, Menu, Users, Mail, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/events", label: "Events", icon: CalendarDays },
  { to: "/admin/checkin", label: "QR Check-in", icon: ScanLine },
  { to: "/admin/users", label: "Admin accounts", icon: Users },
  { to: "/admin/mail-accounts", label: "Mail accounts", icon: Mail },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

function MobileMenu({ onNavigate, isActive }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const go = (to) => {
    onNavigate?.();
    navigate(to);
  };
  return (
    <div className="mt-2 flex flex-col gap-1">
      <span className="px-2 text-lg font-semibold">Admin</span>
      {LINKS.map((l) => (
        <button
          key={l.to}
          onClick={() => go(l.to)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm font-medium",
            isActive(l) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <l.icon className="w-4 h-4" /> {l.label}
        </button>
      ))}
      <div className="my-2 border-t border-border" />
      <button
        onClick={() => go("/")}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Back to site
      </button>
      <div className="mt-2 flex items-center gap-2 px-2 text-xs text-muted-foreground">
        <Avatar src={user?.image} name={user?.full_name || user?.email} className="h-6 w-6" fallbackClassName="text-[10px]" />
        <span className="truncate">{user?.full_name || user?.email}</span>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isActive = (link) => (link.exact ? location.pathname === link.to : location.pathname.startsWith(link.to));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <aside className={cn("sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-white md:flex", sidebarCollapsed ? "w-16" : "w-60")}>
          <div className={cn("group relative flex h-16 items-center border-b border-border", sidebarCollapsed ? "justify-center px-2" : "gap-2 px-5")}>
            <Link to="/admin" aria-label="Admin" className="flex min-w-0 items-center gap-2">
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground", sidebarCollapsed && "group-hover:opacity-0")}><Ticket className="w-4 h-4" /></span>
              {!sidebarCollapsed && <span className="font-semibold">Admin</span>}
            </Link>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!sidebarCollapsed}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground",
                sidebarCollapsed && "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
              )}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} aria-label={sidebarCollapsed ? l.label : undefined} title={sidebarCollapsed ? l.label : undefined} className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors", sidebarCollapsed && "justify-center px-2", isActive(l) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <l.icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span>{l.label}</span>}
              </Link>
            ))}
          </nav>
          <div className="border-t border-border p-3">
            <Link to="/" aria-label={sidebarCollapsed ? "Back to site" : undefined} title={sidebarCollapsed ? "Back to site" : undefined} className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground", sidebarCollapsed && "justify-center px-2")}>
              <ArrowLeft className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Back to site</span>}
            </Link>
            <div className={cn("mt-3 flex items-center gap-2 text-xs text-muted-foreground", sidebarCollapsed ? "justify-center" : "px-3")}>
              <Avatar src={user?.image} name={user?.full_name || user?.email} className="h-6 w-6 shrink-0" fallbackClassName="text-[10px]" />
              {!sidebarCollapsed && <span className="truncate">{user?.full_name || user?.email}</span>}
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-white/90 px-4 backdrop-blur md:hidden">
            <Link to="/admin" className="flex items-center gap-2 font-semibold"><Ticket className="w-4 h-4" /> Admin</Link>
            <div className="ml-auto">
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open admin menu">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72">
                  <MobileMenu onNavigate={() => setMenuOpen(false)} isActive={isActive} />
                </SheetContent>
              </Sheet>
            </div>
          </header>

          <main className="p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}