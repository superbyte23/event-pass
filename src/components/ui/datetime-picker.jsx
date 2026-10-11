"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarDays, Clock, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

function pad(n) {
  return String(n).padStart(2, "0")
}

function toLocalParts(iso) {
  if (!iso) return { date: "", time: "" }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: "", time: "" }
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

function buildIso(parts) {
  const [, y, mo, d, h, mi] = parts.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/).map(Number)
  const dt = new Date(y, mo - 1, d, h, mi)
  return Number.isNaN(dt.getTime()) ? "" : dt.toISOString()
}

function joinParts(date, time) {
  return `${date}T${time || "00:00"}`
}

function formatDisplay(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${format(d, "EEE, MMM d, yyyy")} · ${format(d, "h:mm a")}`
}

export const DateTimePicker = React.forwardRef(
  ({ value, onChange, placeholder = "Pick a date & time…", id, className }, ref) => {
    const [open, setOpen] = React.useState(false)
    const parts = toLocalParts(value)
    const selected = parts.date ? new Date(`${parts.date}T00:00:00`) : undefined

    const apply = (nextParts) => {
      const iso = nextParts.date ? buildIso(joinParts(nextParts.date, nextParts.time)) : ""
      onChange?.(iso)
    }

    const handleDate = (d) => {
      if (!d) return
      const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      apply({ date, time: parts.time || "09:00" })
    }

    const handleTime = (time) => {
      apply({ date: parts.date || new Date().toISOString().slice(0, 10), time })
    }

    const clear = () => {
      onChange?.("")
      setOpen(false)
    }

    const display = formatDisplay(value)

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            id={id}
            type="button"
            className={cn(
              "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors",
              "focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              !display && "text-muted-foreground",
              className
            )}>
            <span className="truncate text-left">{display ?? placeholder}</span>
            <CalendarDays className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0" sideOffset={6}>
          <Calendar
            mode="single"
            selected={selected}
            onSelect={handleDate}
            defaultMonth={selected}
            className="rounded-none border-0"
          />
          <div className="flex items-center gap-2 border-t border-border p-3">
            <div className="relative flex-1">
              <Clock className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="time"
                value={parts.time}
                onChange={(e) => handleTime(e.target.value)}
                className="h-8 pl-8"
                aria-label="Time"
              />
            </div>
            {value && (
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" onClick={clear} aria-label="Clear date and time">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    )
  }
)

DateTimePicker.displayName = "DateTimePicker"