import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { fieldHasOptions } from "@/lib/event-utils";

export default function FormRenderer({ fields, responses, onFieldChange, errors }) {
  if (!fields || fields.length === 0) return null;
  return (
    <div className="space-y-5">
      {fields.map((f) => (
        <div key={f.id} className="space-y-1.5">
          <Label htmlFor={`f-${f.id}`}>
            {f.label}{f.required && <span className="text-rose-500"> *</span>}
          </Label>
          {renderField(f, responses[f.id], onFieldChange)}
          {errors?.[f.id] && <p className="text-xs text-rose-500">{errors[f.id]}</p>}
        </div>
      ))}
    </div>
  );
}

function renderField(f, v, onFieldChange) {
  const value = v ?? "";
  switch (f.type) {
    case "textarea":
      return <Textarea id={`f-${f.id}`} value={value} onChange={(e) => onFieldChange(f.id, e.target.value)} placeholder={f.placeholder} rows={3} />;
    case "email":
      return <Input id={`f-${f.id}`} type="email" value={value} onChange={(e) => onFieldChange(f.id, e.target.value)} placeholder={f.placeholder} />;
    case "phone":
      return <Input id={`f-${f.id}`} type="tel" value={value} onChange={(e) => onFieldChange(f.id, e.target.value)} placeholder={f.placeholder} />;
    case "number":
      return <Input id={`f-${f.id}`} type="number" value={value} onChange={(e) => onFieldChange(f.id, e.target.value)} placeholder={f.placeholder} />;
    case "dropdown":
      return (
        <Select value={value} onValueChange={(val) => onFieldChange(f.id, val)}>
          <SelectTrigger id={`f-${f.id}`}><SelectValue placeholder={f.placeholder || "Select…"} /></SelectTrigger>
          <SelectContent>
            {(f.options || []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    case "choice":
      return (
        <RadioGroup value={value} onValueChange={(val) => onFieldChange(f.id, val)} className="space-y-2">
          {(f.options || []).map((o) => (
            <div key={o} className="flex items-center gap-2">
              <RadioGroupItem id={`${f.id}-${o}`} value={o} />
              <Label htmlFor={`${f.id}-${o}`} className="font-normal">{o}</Label>
            </div>
          ))}
        </RadioGroup>
      );
    case "checkboxes": {
      const arr = Array.isArray(value) ? value : [];
      const toggle = (o) => onFieldChange(f.id, arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
      return (
        <div className="space-y-2">
          {(f.options || []).map((o) => (
            <div key={o} className="flex items-center gap-2">
              <Checkbox id={`${f.id}-${o}`} checked={arr.includes(o)} onCheckedChange={() => toggle(o)} />
              <Label htmlFor={`${f.id}-${o}`} className="font-normal">{o}</Label>
            </div>
          ))}
        </div>
      );
    }
    default:
      return <Input id={`f-${f.id}`} value={value} onChange={(e) => onFieldChange(f.id, e.target.value)} placeholder={f.placeholder} />;
  }
}