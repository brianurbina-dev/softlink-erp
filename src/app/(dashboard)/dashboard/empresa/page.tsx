"use client"

import { useState, useEffect, useRef } from "react"
import {
  Save, Globe, Phone, Mail, MapPin, Building2,
  Upload, ImageIcon, Trash2, Loader2, CheckCircle, AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ApiResponse } from "@/types"

interface EmpresaData {
  id: string
  rut: string
  razonSocial: string
  giro: string | null
  logoUrl: string | null
  telefono: string | null
  emailContacto: string | null
  web: string | null
  direccion: string | null
  ciudad: string | null
  plan: string
}

type FormData = Omit<EmpresaData, "id" | "rut" | "plan" | "logoUrl">

function Field({
  label, value, onChange, placeholder, type = "text", readOnly = false, icon,
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  placeholder?: string
  type?: string
  readOnly?: boolean
  icon?: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-sl-muted">
        {icon}{label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={
          readOnly
            ? "w-full rounded-lg border border-sl-border/50 bg-sl-bg-dark/40 px-3 py-2 text-sm text-sl-muted cursor-not-allowed"
            : "w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
        }
      />
    </div>
  )
}

export default function EmpresaPerfilPage() {
  const [data, setData] = useState<EmpresaData | null>(null)
  const [form, setForm] = useState<FormData>({
    razonSocial: "", giro: null, telefono: null,
    emailContacto: null, web: null, direccion: null, ciudad: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // Logo
  const [hasLogo, setHasLogo] = useState(false)
  const [logoTimestamp, setLogoTimestamp] = useState(Date.now())
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [savingLogo, setSavingLogo] = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch("/api/empresa/perfil")
      .then(r => r.json())
      .then((j: ApiResponse<EmpresaData>) => {
        if (j.data) {
          setData(j.data)
          setForm({
            razonSocial: j.data.razonSocial,
            giro: j.data.giro,
            telefono: j.data.telefono,
            emailContacto: j.data.emailContacto,
            web: j.data.web,
            direccion: j.data.direccion,
            ciudad: j.data.ciudad,
          })
          if (j.data.logoUrl) setHasLogo(true)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  function set(field: keyof FormData, value: string) {
    setForm(f => ({ ...f, [field]: value || null }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch("/api/empresa/perfil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const j = await res.json()
      if (!res.ok) { setMsg({ text: j.error ?? "Error al guardar", ok: false }); return }
      setData(j.data)
      setDirty(false)
      setMsg({ text: "Cambios guardados", ok: true })
      setTimeout(() => setMsg(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (logoRef.current) logoRef.current.value = ""
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  async function saveLogo() {
    if (!logoFile) return
    setSavingLogo(true)
    try {
      const fd = new FormData()
      fd.append("file", logoFile)
      const res = await fetch("/api/empresa/logo", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok) {
        setMsg({ text: json.error ?? "Error al subir logo", ok: false })
        return
      }
      setHasLogo(true)
      setLogoTimestamp(Date.now())
      setLogoFile(null)
      if (logoPreview) { URL.revokeObjectURL(logoPreview); setLogoPreview(null) }
      setMsg({ text: "Logo actualizado", ok: true })
      setTimeout(() => setMsg(null), 3000)
    } finally {
      setSavingLogo(false)
    }
  }

  async function deleteLogo() {
    setSavingLogo(true)
    try {
      const res = await fetch("/api/empresa/logo", { method: "DELETE" })
      if (!res.ok) { setMsg({ text: "Error al eliminar logo", ok: false }); return }
      setHasLogo(false)
      setLogoFile(null)
      if (logoPreview) { URL.revokeObjectURL(logoPreview); setLogoPreview(null) }
      setMsg({ text: "Logo eliminado", ok: true })
      setTimeout(() => setMsg(null), 3000)
    } finally {
      setSavingLogo(false)
    }
  }

  if (loading) return <div className="py-20 text-center text-sm text-sl-muted">Cargando...</div>
  if (!data) return null

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-page-title text-sl-text">Perfil de empresa</h1>
        <p className="mt-0.5 text-sm text-sl-muted">Datos e información de tu empresa</p>
      </div>

      {/* Identidad */}
      <div className="rounded-card border border-sl-border bg-sl-bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-sl-text">
          <Building2 className="h-4 w-4 text-sl-purple" /> Identidad
        </h2>
        <div className="space-y-4">
          {/* Logo */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-sl-muted">
              <ImageIcon className="h-3 w-3" /> Logotipo
              {hasLogo && !logoFile && (
                <span className="ml-auto flex items-center gap-1 rounded-full bg-sl-success/[0.12] px-2 py-0.5 text-xs text-sl-success">
                  <CheckCircle className="h-3 w-3" /> Cargado
                </span>
              )}
            </label>

            <div className="flex items-start gap-4">
              {/* Preview */}
              <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg border border-sl-border bg-sl-bg-dark/40">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="Preview" className="max-h-16 max-w-24 object-contain" />
                ) : hasLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/empresa/logo?t=${logoTimestamp}`}
                    alt="Logo"
                    className="max-h-16 max-w-24 object-contain"
                    onError={() => setHasLogo(false)}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-sl-muted">
                    <ImageIcon className="h-6 w-6 opacity-30" />
                    <span className="text-xs">Sin logo</span>
                  </div>
                )}
              </div>

              {/* Controles */}
              <div className="flex-1 space-y-2">
                <button
                  onClick={() => logoRef.current?.click()}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                    logoFile
                      ? "border-sl-purple/50 bg-sl-purple/[0.06] text-sl-purple-light"
                      : "border-dashed border-sl-border text-sl-muted hover:border-sl-border/80 hover:text-sl-text"
                  )}
                >
                  <Upload className="h-4 w-4 shrink-0" />
                  {logoFile ? logoFile.name : hasLogo ? "Reemplazar imagen" : "Seleccionar imagen"}
                </button>
                <input
                  ref={logoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleLogoSelect}
                />
                <p className="text-xs text-sl-muted">JPG, PNG, WEBP o SVG · Máx. 2 MB · Aparece en PDFs de DTE</p>

                <div className="flex items-center gap-2">
                  {logoFile && (
                    <>
                      <button
                        onClick={saveLogo}
                        disabled={savingLogo}
                        className="flex items-center gap-1.5 rounded-lg bg-sl-purple px-3 py-1.5 text-xs font-medium text-white hover:bg-sl-purple-dark disabled:opacity-50"
                      >
                        {savingLogo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                        Guardar logo
                      </button>
                      <button
                        onClick={() => {
                          setLogoFile(null)
                          if (logoPreview) { URL.revokeObjectURL(logoPreview); setLogoPreview(null) }
                        }}
                        className="text-xs text-sl-muted hover:text-sl-text"
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                  {hasLogo && !logoFile && (
                    <button
                      onClick={deleteLogo}
                      disabled={savingLogo}
                      className="flex items-center gap-1.5 rounded-lg border border-sl-danger/40 px-3 py-1.5 text-xs text-sl-danger hover:bg-sl-danger/[0.08] disabled:opacity-50"
                    >
                      {savingLogo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Eliminar logo
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Field label="RUT" value={data.rut} readOnly placeholder="" />
          <Field
            label="Razón social *"
            value={form.razonSocial ?? ""}
            onChange={v => set("razonSocial", v)}
            placeholder="Empresa SpA"
          />
          <Field
            label="Giro"
            value={form.giro ?? ""}
            onChange={v => set("giro", v)}
            placeholder="Comercio al por menor..."
          />
        </div>
      </div>

      {/* Contacto */}
      <div className="rounded-card border border-sl-border bg-sl-bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-sl-text">Contacto</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Teléfono" value={form.telefono ?? ""} onChange={v => set("telefono", v)} placeholder="+56 2 2123 4567" icon={<Phone className="h-3 w-3" />} />
          <Field label="Email de contacto" value={form.emailContacto ?? ""} onChange={v => set("emailContacto", v)} placeholder="contacto@empresa.cl" type="email" icon={<Mail className="h-3 w-3" />} />
          <Field label="Sitio web" value={form.web ?? ""} onChange={v => set("web", v)} placeholder="https://empresa.cl" icon={<Globe className="h-3 w-3" />} />
          <Field label="Ciudad" value={form.ciudad ?? ""} onChange={v => set("ciudad", v)} placeholder="Santiago" icon={<MapPin className="h-3 w-3" />} />
          <div className="sm:col-span-2">
            <Field label="Dirección" value={form.direccion ?? ""} onChange={v => set("direccion", v)} placeholder="Av. Providencia 1234, Piso 5" icon={<MapPin className="h-3 w-3" />} />
          </div>
        </div>
      </div>

      {/* Plan */}
      <div className="rounded-card border border-sl-border bg-sl-bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-sl-text">Plan</h2>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-sl-purple/15 px-3 py-1 text-sm font-medium capitalize text-sl-purple-light">
            {data.plan}
          </span>
          <span className="text-xs text-sl-muted">Para cambiar de plan, contáctanos</span>
        </div>
      </div>

      {/* Guardar */}
      <div className="flex items-center justify-end gap-4">
        {msg && (
          <span className={cn(
            "flex items-center gap-1.5 text-sm font-medium",
            msg.ok ? "text-sl-success" : "text-sl-danger"
          )}>
            {msg.ok
              ? <CheckCircle className="h-4 w-4 shrink-0" />
              : <AlertTriangle className="h-4 w-4 shrink-0" />}
            {msg.text}
          </span>
        )}
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="flex items-center gap-1.5 rounded-lg bg-sl-purple px-4 py-2 text-sm font-medium text-white hover:bg-sl-purple-dark disabled:opacity-40"
        >
          <Save className="h-4 w-4" />
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  )
}
