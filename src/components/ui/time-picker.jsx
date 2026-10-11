"use client"

import * as React from "react"
import { Clock, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const HOURS = ["12", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"]
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"]
const PAD = (n) => String(n).padStart(2, "0")

function parseParts(value) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return { h24: 0, min: 0 }
  const [h, m] = value.split(":").map(Number)
  return { h24: h, min: m }
}

function toValue(h24, min) {
  return `${PAD(h24)}:${PAD(min)}`
}

function polar(i, count, radius, cx, cy) {
  const angle = -Math.PI / 2 + (2 * Math.PI * i) / count
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
}

export const TimePicker = React.forwardRef(({ value, onChange, placeholder = "Pick a time…", id, className }, ref) => {
  const [open, setOpen] = React.useState(false)
  const [mode, setMode] = React.useState("hour")

  const parts = parseParts(value)
  const hrLabel = parts.h24 % 12 === 0 ? "12" : String(parts.h24 % 12)
  const meridiem = parts.h24 < 12 ? "AM" : "PM"
  const display = value && /^\d{2}:\d{2}$/.test(value) ? `${hrLabel}:${PAD(parts.min)} ${meridiem}` : null

  const apply = (nextH24, nextMin) => onChange(toValue(nextH24, nextMin))

  const selectHour = (label) => {
    const hv = label === "12" ? 0 : Number(label)
    const nextH24 = meridiem === "AM" ? hv : hv + 12
    apply(nextH24, parts.min)
    setMode("minute")
  }

  const selectMinute = (label) => {
    apply(parts.h24, Number(label))
    setOpen(false)
  }

  const setMeridiem = (next) => {
    const hv = hrLabel === "12" ? 0 : Number(hrLabel)
    const nextH24 = next === "AM" ? hv : hv === 0 ? 12 : hv + 12
    apply(nextH24, parts.min)
  }

  const clear = () => {
    onChange("")
    setOpen(false)
  }

  const SIZE = 224
  const RADIUS = 78
  const items = mode === "hour" ? HOURS : MINUTES
  const isSelected = (label) =>
    mode === "hour" ? label === hrLabel : Number(label) === parts.min

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
          <Clock className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0" sideOffset={6}>
        <div className="flex items-center justify-center gap-1 border-b border-border px-4 py-3">
          <button
            type="button"
            onClick={() => setMode("hour")}
            className={cn(
              "rounded px-1.5 text-3xl font-semibold tabular-nums transition-colors",
              mode === "hour" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}>
            {hrLabel}
          </button>
          <span className="text-3xl font-semibold text-muted-foreground">:</span>
          <button
            type="button"
            onClick={() => setMode("minute")}
            className={cn(
              "rounded px-1.5 text-3xl font-semibold tabular-nums transition-colors",
              mode === "minute" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}>
            {PAD(parts.min)}
          </button>
          <span className="mx-3 h-8 w-px bg-border" />
          <div className="inline-flex flex-col overflow-hidden rounded-md border border-border text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMeridiem("AM")}
              className={cn("px-2 py-0.5 transition-colors", meridiem === "AM" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              AM
            </button>
            <button
              type="button"
              onClick={() => setMeridiem("PM")}
              className={cn("border-t border-border px-2 py-0.5 transition-colors", meridiem === "PM" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              PM
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
            <div className="absolute inset-0 rounded-full bg-muted/40" />
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
            {items.map((label, i) => {
              const pos = polar(i, items.length, RADIUS, SIZE / 2, SIZE / 2)
              const selected = isSelected(label)
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => (mode === "hour" ? selectHour(label) : selectMinute(label))}
                  className={cn(
                    "absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm font-medium tabular-nums transition-colors",
                    "focus:outline-none focus:ring-1 focus:ring-ring",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  )}
                  style={{ left: pos.x, top: pos.y }}>
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-3 py-2">
          <div className="text-sm font-medium tabular-nums text-muted-foreground">
            {hrLabel}:{PAD(parts.min)} {meridiem}
          </div>
          {value && (
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={clear} aria-label="Clear time">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
})

TimePicker.displayName = "TimePicker"