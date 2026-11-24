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
      if (itemValue !== undefined) {
        const label = child.props?.label ?? (nodeToText(child.props?.children) || String(itemValue))
        map.set(itemValue, label)
      }
      return
    }
    if (child.props?.children) collectItemLabels(child.props.children, map)
  })
}

const Select = ({
  value: valueProp = undefined,
  defaultValue = undefined,
  onValueChange = undefined,
  open: openProp = undefined,
  onOpenChange = undefined,
  disabled = false,
  multiple = false,
  children = undefined,
}) => {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = openProp !== undefined ? openProp : internalOpen
  const setOpen = React.useCallback(
    (next) => {
      if (openProp === undefined) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [openProp, onOpenChange]
  )

  const [internal, setInternal] = React.useState(
    defaultValue !== undefined ? defaultValue : multiple ? [] : undefined
  )
  const value = valueProp !== undefined ? valueProp : internal
  const setValue = React.useCallback(
    (next) => {
      if (multiple) {
        const current = Array.isArray(value) ? value : []
        const updated = current.includes(next)
          ? current.filter((item) => item !== next)
          : [...current, next]
        if (valueProp === undefined) setInternal(updated)
        onValueChange?.(updated)
        return
      }

      if (valueProp === undefined) setInternal(next)
      onValueChange?.(next)
      setOpen(false)
    },
    [valueProp, onValueChange, multiple, value, setOpen]
  )

  const labels = React.useMemo(() => {
    const map = new Map()
    collectItemLabels(children, map)
    return map
  }, [children])

  const ctx = React.useMemo(
    () => ({ value, setValue, open, setOpen, disabled, labels, multiple }),
    [value, setValue, open, setOpen, disabled, labels, multiple]
  )

  return (
    <SelectContext.Provider value={ctx}>
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        {children}
      </PopoverPrimitive.Root>
    </SelectContext.Provider>
  )
}

const SelectValue = React.forwardRef(/** @type {React.ForwardRefRenderFunction<any, any>} */ (({ className, placeholder, ...props }, ref) => {
  const { value, labels, multiple } = useSelect()
  const hasValue = multiple
    ? Array.isArray(value) && value.length > 0
    : value !== undefined && value !== null && value !== ""

  let label
  if (hasValue) {
    if (multiple) {
      const selected = value.map((item) => labels.get(item) ?? String(item)).filter(Boolean)
      label = selected.length === 1 ? selected[0] : `${selected.length} admins selected`
    } else {
      label = labels.get(value) ?? String(value)
    }
  }

  return (
    <span
      ref={ref}
      className={cn(
        "block min-w-0 flex-1 truncate text-left",
        !label && "text-muted-foreground",
        className
      )}
      {...props}>
      {label ?? placeholder}
    </span>
  )
}))
SelectValue.displayName = "SelectValue"

const SelectTrigger = React.forwardRef(/** @type {React.ForwardRefRenderFunction<any, any>} */ (({ className, children, ...props }, ref) => {
  const { disabled } = useSelect()
  return (
    <PopoverPrimitive.Trigger asChild>
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        className={cn(
          "flex h-9 w-full min-w-0 items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:min-w-0 [&>span]:flex-1 [&>span]:truncate",
          className
        )}
        {...props}>
        {children}
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>
    </PopoverPrimitive.Trigger>
  )
}))
SelectTrigger.displayName = "SelectTrigger"

const SelectContent = React.forwardRef(
  /** @type {React.ForwardRefRenderFunction<any, any>} */ (({ className, children, align = "start", sideOffset = 4, ...props }, ref) => {
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
  })
)
SelectContent.displayName = "SelectContent"

const SelectGroup = React.forwardRef(/** @type {React.ForwardRefRenderFunction<any, any>} */ (({ className, ...props }, ref) => (
  <CommandGroup ref={ref} className={className} {...props} />
)))
SelectGroup.displayName = "SelectGroup"

const SelectLabel = React.forwardRef(/** @type {React.ForwardRefRenderFunction<any, any>} */ (({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props} />
)))
SelectLabel.displayName = "SelectLabel"

const SelectItem = React.forwardRef(/** @type {React.ForwardRefRenderFunction<any, any>} */ (({ className, children, value: itemValue, ...props }, ref) => {
  const { value, setValue, multiple } = useSelect()
  const label = nodeToText(children) || String(itemValue ?? "")
  const selected = multiple
    ? Array.isArray(value) && value.includes(itemValue)
    : value !== undefined && value !== null && value !== "" && value === itemValue

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
      <span className="block truncate">{children}</span>
    </CommandItem>
  )
}))
SelectItem.displayName = "SelectItem"

const SelectSeparator = React.forwardRef(/** @type {React.ForwardRefRenderFunction<any, any>} */ (({ className, ...props }, ref) => (
  <CommandSeparator ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
)))
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
