"use client"

import { useState } from "react"
import { validarRut, formatRutDisplay } from "@/lib/chile/rut"
import { cn } from "@/lib/utils"

interface RutInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function RutInput({ value, onChange, placeholder = "12.345.678-9", className, disabled }: RutInputProps) {
  const [touched, setTouched] = useState(false)

  const isValid = value ? validarRut(value) : true
  const showError = touched && !!value && !isValid

  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          setTouched(true)
          if (value && validarRut(value)) onChange(formatRutDisplay(value))
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "w-full rounded-lg border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none transition-colors",
          "placeholder:text-sl-muted disabled:cursor-not-allowed disabled:opacity-50",
          showError ? "border-sl-danger" : "border-sl-border focus:border-sl-purple",
          className
        )}
      />
      {touched && !!value && (
        <p className={cn("mt-1 text-xs", isValid ? "text-sl-success" : "text-sl-danger")}>
          {isValid ? "RUT válido ✓" : "RUT inválido"}
        </p>
      )}
    </div>
  )
}
