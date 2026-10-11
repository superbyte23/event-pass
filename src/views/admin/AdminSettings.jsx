import { db } from "@/api/db";

import { useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ShieldCheck, UserCog, Mail } from "lucide-react";

export default function AdminSettings() {
  const { refreshSettings } = useAuth();
  const [record, setRecord] = useState(undefined);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await db.entities.Setting.list();
        if (!alive) return;
        const rec = list && list[0] ? list[0] : null;
        setRecord(rec);
        setEnabled(rec ? rec.google_auth_enabled !== false : true);
      } catch {
        if (alive) { setRecord(null); setEnabled(true); }
      }
    })();
    return () => { alive = false; };
  }, []);

  const toggle = async (val) => {
    setEnabled(val);
    setSaving(true);
    try {
      let rec = record;
      if (!rec) {
        rec = await db.entities.Setting.create({ google_auth_enabled: val });
        setRecord(rec);
      } else {
        rec = await db.entities.Setting.update(rec.id, { google_auth_enabled: val });
      }
      await refreshSettings();
      toast({ title: val ? "Google sign-in enabled" : "Google sign-in disabled" });
    } catch (e) {
      setEnabled(!val);
      toast({ variant: "destructive", title: "Could not save setting", description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  if (record === undefined) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Control how guests register for your events.</p>
      </div>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-base font-semibold">Google sign-in for guests</h2>
            </div>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              When on, guests sign in with Google to register — one ticket per Google account per event.
              When off, guests skip login and register with a simple form (name + email) — one ticket per email per event. You still sign in with Google to manage events.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={toggle} disabled={saving} />
        </div>
        <div className="mt-4 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          {enabled ? (
            <span className="inline-flex items-center gap-1.5"><UserCog className="w-4 h-4" /> Guests sign in with Google to register.</span>
          ) : (
            <span className="inline-flex items-center gap-1.5"><Mail className="w-4 h-4" /> Guests register with a form — no login needed.</span>
          )}
        </div>
      </Card>
    </div>
  );
}