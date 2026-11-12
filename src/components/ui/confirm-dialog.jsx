"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "destructive",
  onConfirm,
  disabled = false,
}) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    if (disabled || loading) return
    setLoading(true)
    try {
      await onConfirm?.()
    } finally {
      setLoading(false)
      onOpenChange(false)
    }
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={variant} onClick={handleConfirm} disabled={loading || disabled}>
            {loading ? "Processing..." : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function useConfirm() {
  const [state, setState] = useState({
    open: false,
    title: "",
    description: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    variant: "destructive",
    onConfirm: null,
  })

  const confirm = (options) => {
    return new Promise((resolve) => {
      setState({
        open: true,
        title: options.title || "Confirm",
        description: options.description || "Are you sure?",
        confirmText: options.confirmText || "Confirm",
        cancelText: options.cancelText || "Cancel",
        variant: options.variant || "destructive",
        onConfirm: () => resolve(true),
      })
    })
  }

  const close = () => setState((s) => ({ ...s, open: false }))

  return {
    ...state,
    confirm,
    close,
    ConfirmDialog: (
      <ConfirmDialog
        open={state.open}
        onOpenChange={close}
        title={state.title}
        description={state.description}
        confirmText={state.confirmText}
        cancelText={state.cancelText}
        variant={state.variant}
        onConfirm={state.onConfirm}
      />
    ),
  }
}