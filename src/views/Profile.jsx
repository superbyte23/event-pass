import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

import SiteNav from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/event-utils";
import { Ticket, LogOut, Mail, ShieldCheck, CalendarDays } from "lucide-react";

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout(false);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-muted-foreground">Your account details.</p>

        <Card className="mt-8 overflow-hidden">
          <div className="flex flex-col items-center gap-4 bg-gradient-to-br from-slate-50 to-background p-8 sm:flex-row sm:items-center sm:gap-6">
            {user?.image ? (
              <img src={user.image} alt="" className="h-20 w-20 rounded-full object-cover ring-4 ring-background shadow-sm" />
            ) : (
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-semibold text-primary-foreground">
                {(user?.full_name || user?.email || "?").charAt(0).toUpperCase()}
              </span>
            )}
            <div className="text-center sm:text-left">
              <h2 className="text-xl font-semibold">{user?.full_name || "Guest"}</h2>
              <div className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground sm:justify-start">
                <Mail className="w-4 h-4" /> {user?.email}
              </div>
              <div className="mt-2 flex items-center justify-center gap-2 sm:justify-start">
                {user?.role === "admin" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                    <ShieldCheck className="w-3.5 h-3.5" /> Admin
                  </span>
                )}
                <span className="text-xs text-muted-foreground">Joined {formatDate(user?.created_date)}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t border-border p-6 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => navigate("/my-events")}><Ticket className="w-4 h-4 mr-1.5" /> My tickets</Button>
            <Button variant="ghost" onClick={handleLogout}><LogOut className="w-4 h-4 mr-1.5" /> Sign out</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}