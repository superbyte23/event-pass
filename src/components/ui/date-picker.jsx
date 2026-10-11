"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarDays, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export const DatePicker = React.forwardRef(({ value, onChange, placeholder = "Pick a date…", id, className }, ref) => {
  const [open, setOpen] = React.useState(false)
  const selected = value ? new Date(`${value}T00:00:00`) : undefined
  const display = value ? format(new Date(`${value}T00:00:00`), "EEE, MMM d, yyyy") : null

  const handleDate = (d) => {
    if (!d) return
    const pad = (n) => String(n).padStart(2, "0")
    onChange(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
    setOpen(false)
  }

  const clear = () => {
    onChange("")
    setOpen(false)
  }

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
        <div className="flex items-center justify-between border-t border-border px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => handleDate(new Date())}
          >
            Today
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={clear}
              aria-label="Clear date"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
})

DatePicker.displayName = "DatePicker"