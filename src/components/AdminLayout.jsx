import { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LayoutDashboard, CalendarDays, Settings, ArrowLeft, Ticket, ScanLine, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/events", label: "Events", icon: CalendarDays },
  { to: "/admin/checkin", label: "QR Check-in", icon: ScanLine },
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
        {user?.image ? <img src={user.image} alt="" className="h-6 w-6 rounded-full" /> : <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-semibold">{(user?.full_name || "?").charAt(0)}</span>}
        <span className="truncate">{user?.full_name || user?.email}</span>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isActive = (link) => (link.exact ? location.pathname === link.to : location.pathname.startsWith(link.to));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-white md:flex">
          <Link to="/admin" className="flex items-center gap-2 px-5 h-16 border-b border-border">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Ticket className="w-4 h-4" /></span>
            <span className="font-semibold">Admin</span>
          </Link>
          <nav className="flex-1 space-y-1 p-3">
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors", isActive(l) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <l.icon className="w-4 h-4" /> {l.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-border p-3">
            <Link to="/" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              <ArrowLeft className="w-4 h-4" /> Back to site
            </Link>
            <div className="mt-3 flex items-center gap-2 px-3 text-xs text-muted-foreground">
              {user?.image ? <img src={user.image} alt="" className="h-6 w-6 rounded-full" /> : <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-semibold">{(user?.full_name || "?").charAt(0)}</span>}
              <span className="truncate">{user?.full_name || user?.email}</span>
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