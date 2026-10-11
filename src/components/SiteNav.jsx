import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Ticket, LayoutDashboard, CalendarDays, User, LogOut, LogIn, Menu, ShieldCheck, Search } from "lucide-react";

function MobileItem({ to, onNavigate, icon: Icon, children }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => {
        onNavigate?.();
        navigate(to);
      }}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Icon className="w-4 h-4" /> {children}
    </button>
  );
}

// Mobile sheet mirrors the desktop links, including auth gating: no dead-end
// links for logged-out visitors, and sign in/out actions.
function MobileMenu({ onNavigate }) {
  const { isAuthenticated, user, logout, googleAuthEnabled } = useAuth();
  const googleMode = googleAuthEnabled !== false;
  const navigate = useNavigate();
  const handleLogout = () => {
    onNavigate?.();
    logout(false);
    navigate("/");
  };

  return (
    <div className="mt-2 flex flex-col gap-1">
      <span className="px-2 text-lg font-semibold">Menu</span>
      <MobileItem to="/events" onNavigate={onNavigate} icon={CalendarDays}>Events</MobileItem>
      <MobileItem to="/find-ticket" onNavigate={onNavigate} icon={Search}>Find Ticket</MobileItem>
      {isAuthenticated && (
        <MobileItem to="/my-events" onNavigate={onNavigate} icon={Ticket}>My Tickets</MobileItem>
      )}
      {isAuthenticated && user?.role === "admin" && (
        <MobileItem to="/admin" onNavigate={onNavigate} icon={LayoutDashboard}>Admin</MobileItem>
      )}
      {!isAuthenticated && !googleMode && (
        <MobileItem to="/admin" onNavigate={onNavigate} icon={ShieldCheck}>Admin</MobileItem>
      )}
      <div className="my-2 border-t border-border" />
      {isAuthenticated ? (
        <>
          <MobileItem to="/profile" onNavigate={onNavigate} icon={User}>
            <span className="flex items-center gap-2">
              {user?.image ? (
                <img src={user.image} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-semibold">
                  {(user?.full_name || user?.email || "?").charAt(0).toUpperCase()}
                </span>
              )}
              <span className="truncate">{user?.full_name || "Profile"}</span>
            </span>
          </MobileItem>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </>
      ) : (
        <MobileItem to="/login" onNavigate={onNavigate} icon={LogIn}>Sign in</MobileItem>
      )}
    </div>
  );
}

function NavLinks({ onNavigate }) {
  const { isAuthenticated, user, logout, googleAuthEnabled } = useAuth();
  const googleMode = googleAuthEnabled !== false;
  const navigate = useNavigate();
  const go = (path) => {
    onNavigate?.();
    navigate(path);
  };
  const handleLogout = () => {
    onNavigate?.();
    logout(false);
    navigate("/");
  };

  return (
    <>
      <button onClick={() => go("/events")} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Events</button>
      <button onClick={() => go("/find-ticket")} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Find Ticket</button>
      {isAuthenticated && (
        <button onClick={() => go("/my-events")} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">My Tickets</button>
      )}
      {isAuthenticated && user?.role === "admin" && (
        <button onClick={() => go("/admin")} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Admin</button>
      )}
      <div className="h-5 w-px bg-border hidden sm:block" />
      {isAuthenticated ? (
        <div className="flex items-center gap-3">
          <button onClick={() => go("/profile")} className="flex items-center gap-2 text-sm font-medium text-foreground hover:opacity-80 transition-opacity">
            {user?.image ? (
              <img src={user.image} alt="" className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
                {(user?.full_name || user?.email || "?").charAt(0).toUpperCase()}
              </span>
            )}
            <span className="hidden sm:inline max-w-[120px] truncate">{user?.full_name || "Account"}</span>
          </button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
            <LogOut className="w-4 h-4 mr-1.5" /> Sign out
          </Button>
        </div>
      ) : googleMode ? (
        <Button size="sm" onClick={() => go("/login")}>
          <LogIn className="w-4 h-4 mr-1.5" /> Sign in
        </Button>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => go("/admin")}>
          <ShieldCheck className="w-4 h-4 mr-1.5" /> Admin
        </Button>
      )}
    </>
  );
}

export default function SiteNav() {
  // Controlled open state: closing the sheet is explicit in every action
  // (no reliance on auto-close internals racing with navigation/logout).
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Ticket className="w-5 h-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight">EventPass</span>
          </Link>

          <nav className="hidden md:flex items-center gap-5">
            <NavLinks />
          </nav>

          <div className="md:hidden">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <MobileMenu onNavigate={closeMenu} />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}