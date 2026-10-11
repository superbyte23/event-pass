import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import ImageUpload from "@/components/ImageUpload";
import FormBuilder from "@/components/FormBuilder";
import { slugify } from "@/lib/event-utils";

const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "full", label: "Full" },
  { value: "completed", label: "Completed" },
];

const empty = {
  name: "", slug: "", description: "", cover_image: "", logo: "",
  date: "", start_time: "", end_time: "", venue: "", venue_address: "",
  registration_start: "", registration_end: "", max_attendees: "",
  status: "draft", published: false, accent_color: "#0f172a", form_fields: [],
};

function mergeForm(ev) {
  const merged = { ...empty, ...(ev || {}) };
  for (const key of Object.keys(empty)) {
    if (merged[key] == null) merged[key] = empty[key];
  }
  return merged;
}

export default function EventForm({ initialEvent, onSubmit, submitting, submitLabel = "Save event" }) {
  const [form, setForm] = useState(() => mergeForm(initialEvent));
  const [slugTouched, setSlugTouched] = useState(!!initialEvent?.slug);

  useEffect(() => {
    setForm(mergeForm(initialEvent));
    setSlugTouched(!!initialEvent?.slug);
  }, [initialEvent]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const onNameChange = (val) => {
    set("name", val);
    if (!slugTouched) set("slug", slugify(val));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.date) { alert("Event date is required."); return; }
    const payload = {
      ...form,
      max_attendees: form.max_attendees === "" ? null : Number(form.max_attendees),
    };
    if (!payload.max_attendees) payload.max_attendees = null;
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Branding</h2>
        <div className="grid gap-5 md:grid-cols-2">
          <ImageUpload label="Cover image" hint="16:9 recommended" value={form.cover_image} onChange={(v) => set("cover_image", v)} />
          <ImageUpload label="Event logo" hint="Square, transparent PNG" aspect="aspect-square" value={form.logo} onChange={(v) => set("logo", v)} />
        </div>
        <div className="grid gap-4">
          <div>
            <Label htmlFor="name">Event name</Label>
            <Input id="name" value={form.name} onChange={(e) => onNameChange(e.target.value)} required placeholder="2026 Technology and Innovation Summit" />
          </div>
          <div>
            <Label htmlFor="slug">Slug (public URL)</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">/events/</span>
              <Input id="slug" value={form.slug} onChange={(e) => { setSlugTouched(true); set("slug", slugify(e.target.value)); }} required placeholder="tech-summit-2026" />
            </div>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} placeholder="Tell guests what this event is about…" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="accent">Accent color</Label>
              <div className="flex items-center gap-2">
                <input id="accent" type="color" value={form.accent_color} onChange={(e) => set("accent_color", e.target.value)} className="h-9 w-12 rounded-md border border-border bg-background p-1" />
                <Input value={form.accent_color} onChange={(e) => set("accent_color", e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Schedule & venue</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="date">Event date</Label>
            <DatePicker id="date" value={form.date} onChange={(v) => set("date", v)} />
          </div>
          <div>
            <Label htmlFor="start_time">Start time</Label>
            <TimePicker id="start_time" value={form.start_time} onChange={(v) => set("start_time", v)} />
          </div>
          <div>
            <Label htmlFor="end_time">End time</Label>
            <TimePicker id="end_time" value={form.end_time} onChange={(v) => set("end_time", v)} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="venue">Venue</Label>
            <Input id="venue" value={form.venue} onChange={(e) => set("venue", e.target.value)} required placeholder="KCC Convention Center" />
          </div>
          <div>
            <Label htmlFor="venue_address">Venue address</Label>
            <Input id="venue_address" value={form.venue_address} onChange={(e) => set("venue_address", e.target.value)} placeholder="Kabankalan City, Negros Occidental" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Registration</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="max_attendees">Max attendees</Label>
            <Input id="max_attendees" type="number" min="1" value={form.max_attendees ?? ""} onChange={(e) => set("max_attendees", e.target.value)} placeholder="500" />
          </div>
          <div>
            <Label htmlFor="registration_start">Registration opens</Label>
            <DateTimePicker id="registration_start" value={form.registration_start} onChange={(iso) => set("registration_start", iso)} placeholder="When can guests register?" />
          </div>
          <div>
            <Label htmlFor="registration_end">Registration closes</Label>
            <DateTimePicker id="registration_end" value={form.registration_end} onChange={(iso) => set("registration_end", iso)} placeholder="When does registration close?" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="status">Registration status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger id="status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="published" className="cursor-pointer">Published</Label>
              <p className="text-xs text-muted-foreground">Visible on the public event page</p>
            </div>
            <Switch id="published" checked={!!form.published} onCheckedChange={(v) => set("published", v)} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Registration form</h2>
          <p className="text-xs text-muted-foreground">Build the form guests fill out when they register. Leave empty for a simple confirm-only registration.</p>
        </div>
        <FormBuilder fields={form.form_fields || []} onChange={(f) => set("form_fields", f)} />
      </section>

      <div className="flex justify-end gap-3 border-t border-border pt-6">
        <Button type="submit" disabled={submitting}>{submitLabel}</Button>
      </div>
    </form>
  );
}