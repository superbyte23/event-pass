import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FIELD_TYPES, fieldHasOptions, newField } from "@/lib/event-utils";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";

export default function FormBuilder({ fields, onChange }) {
  const update = (id, patch) => onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const remove = (id) => onChange(fields.filter((f) => f.id !== id));
  const add = () => onChange([...(fields || []), newField()]);
  const move = (index, dir) => {
    const next = [...fields];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          No fields yet. Guests will see a simple confirm button. Add fields to collect details like name, contact, or preferences.
        </p>
      )}
      {fields.map((f, i) => (
        <div key={f.id} className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <div className="flex flex-col gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={i === fields.length - 1} onClick={() => move(i, 1)}><ChevronDown className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`label-${f.id}`}>Field label</Label>
                  <Input id={`label-${f.id}`} value={f.label ?? ""} onChange={(e) => update(f.id, { label: e.target.value })} placeholder="Full name" />
                </div>
                <div>
                  <Label htmlFor={`type-${f.id}`}>Type</Label>
                  <Select value={f.type} onValueChange={(v) => update(f.id, { type: v })}>
                    <SelectTrigger id={`type-${f.id}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor={`ph-${f.id}`}>Placeholder (optional)</Label>
                <Input id={`ph-${f.id}`} value={f.placeholder || ""} onChange={(e) => update(f.id, { placeholder: e.target.value })} placeholder="e.g. Juan Dela Cruz" />
              </div>
              {fieldHasOptions(f.type) && (
                <div>
                  <Label htmlFor={`opt-${f.id}`}>Options (one per line)</Label>
                  <Textarea id={`opt-${f.id}`} rows={3} value={(f.options || []).join("\n")} onChange={(e) => update(f.id, { options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} placeholder={"Small\nMedium\nLarge"} />
                </div>
              )}
              <div className="flex items-center justify-between">
                <label htmlFor={`req-${f.id}`} className="flex items-center gap-2 text-sm">
                  <Switch id={`req-${f.id}`} checked={!!f.required} onCheckedChange={(v) => update(f.id, { required: v })} />
                  Required
                </label>
                <Button type="button" variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700" onClick={() => remove(f.id)}><Trash2 className="w-4 h-4 mr-1" /> Remove</Button>
              </div>
            </div>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={add}><Plus className="w-4 h-4 mr-1.5" /> Add field</Button>
    </div>
  );
}