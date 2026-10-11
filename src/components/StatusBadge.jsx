import { cn } from "@/lib/utils";
import { eventStatusInfo, regStatusInfo } from "@/lib/event-utils";

const base =
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium";

export function EventStatusBadge({ status, className }) {
  const info = eventStatusInfo(status);
  return <span className={cn(base, info.className, className)}>{info.label}</span>;
}

export function RegStatusBadge({ status, className }) {
  const info = regStatusInfo(status);
  return <span className={cn(base, info.className, className)}>{info.label}</span>;
}