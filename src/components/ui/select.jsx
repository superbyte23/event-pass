"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"

const SelectContext = React.createContext(null)

function useSelect() {
  const ctx = React.useContext(SelectContext)
  if (!ctx) throw new Error("Select components must be used within <Select>")
  return ctx
}

function nodeToText(node) {
  if (node == null || node === false || node === true) return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(nodeToText).join("")
  if (React.isValidElement(node)) return nodeToText(node.props?.children)
  return ""
}

function collectItemLabels(node, map) {
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return
    if (child.type === SelectItem) {
      const itemValue = child.props?.value
      if (itemValue !== undefined && !map.has(itemValue)) {
        map.set(itemValue, nodeToText(child.props?.children) || String(itemValue))
      }
      return
    }
    if (child.type === SelectContent || child.type === SelectGroup || child.type === React.Fragment) {
      collectItemLabels(child.props?.children, map)
    }
  })
}

function Select({ value, defaultValue, onValueChange, open: openProp, onOpenChange, disabled, children }) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue)
  const isControlled = value !== undefined
  const current = isControlled ? value : uncontrolled

  const [openState, setOpenState] = React.useState(false)
  const open = openProp !== undefined ? openProp : openState

  const labels = React.useMemo(() => {
    const map = new Map()
    collectItemLabels(children, map)
    return map
  }, [children])

  const setOpen = React.useCallback(
    (next) => {
      setOpenState(next)
      onOpenChange?.(next)
    },
    [onOpenChange],
  )

  const setValue = React.useCallback(
    (val) => {
      if (!isControlled) setUncontrolled(val)
      onValueChange?.(val)
      setOpen(false)
    },
    [isControlled, onValueChange, setOpen],
  )

  const ctx = React.useMemo(
    () => ({ value: current, setValue, open, setOpen, disabled, labels }),
    [current, setValue, open, setOpen, disabled, labels],
  )

  return (
    <SelectContext.Provider value={ctx}>
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        {children}
      </PopoverPrimitive.Root>
    </SelectContext.Provider>
  )
}

const SelectValue = React.forwardRef(({ className, placeholder, ...props }, ref) => {
  const { value, labels } = useSelect()
  const hasValue = value !== undefined && value !== null && value !== ""
  const label = hasValue ? labels.get(value) : undefined
  return (
    <span
      ref={ref}
      className={cn("line-clamp-1", !label && "text-muted-foreground", className)}
      {...props}>
      {label ?? placeholder}
    </span>
  )
})
SelectValue.displayName = "SelectValue"

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
  const { disabled } = useSelect()
  return (
    <PopoverPrimitive.Trigger asChild>
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        className={cn(
          "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
          className
        )}
        {...props}>
        {children}
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>
    </PopoverPrimitive.Trigger>
  )
})
SelectTrigger.displayName = "SelectTrigger"

const SelectContent = React.forwardRef(
  ({ className, children, align = "start", sideOffset = 4, ...props }, ref) => {
    const { open } = useSelect()
    const [search, setSearch] = React.useState("")
    const inputRef = React.useRef(null)

    React.useEffect(() => {
      if (!open) setSearch("")
    }, [open])

    return (
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          ref={ref}
          align={align}
          sideOffset={sideOffset}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            inputRef.current?.focus()
          }}
          className={cn(
            "relative z-50 max-h-96 w-[var(--radix-popover-trigger-width)] min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            className
          )}
          {...props}>
          <Command value={search} onValueChange={setSearch} className="[&_[cmdk-input-wrapper]]:border-0">
            <CommandInput ref={inputRef} placeholder="Search…" className="h-9 py-2" />
            <CommandList className="max-h-64">
              <CommandEmpty>No results found.</CommandEmpty>
              {children}
            </CommandList>
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    )
  }
)
SelectContent.displayName = "SelectContent"

const SelectGroup = React.forwardRef(({ className, ...props }, ref) => (
  <CommandGroup ref={ref} className={className} {...props} />
))
SelectGroup.displayName = "SelectGroup"

const SelectLabel = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props} />
))
SelectLabel.displayName = "SelectLabel"

const SelectItem = React.forwardRef(({ className, children, value: itemValue, ...props }, ref) => {
  const { value, setValue } = useSelect()
  const label = nodeToText(children) || String(itemValue ?? "")
  const selected = value !== undefined && value !== null && value !== "" && value === itemValue

  return (
    <CommandItem
      ref={ref}
      value={label}
      keywords={itemValue != null ? [String(itemValue)] : undefined}
      onSelect={() => setValue(itemValue)}
      className={cn("relative w-full cursor-default select-none rounded-sm py-1.5 pl-2 pr-8", className)}
      {...props}>
      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        {selected && <Check className="h-4 w-4" />}
      </span>
      {children}
    </CommandItem>
  )
})
SelectItem.displayName = "SelectItem"

const SelectSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <CommandSeparator ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
))
SelectSeparator.displayName = "SelectSeparator"

const SelectScrollUpButton = () => null
SelectScrollUpButton.displayName = "SelectScrollUpButton"

const SelectScrollDownButton = () => null
SelectScrollDownButton.displayName = "SelectScrollDownButton"

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
