"use client"

import { useState, useEffect } from "react"
import { Save, Globe, Phone, Mail, MapPin, Building2 } from "lucide-react"
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

type FormData = Omit<EmpresaData, "id" | "rut" | "plan">

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
    razonSocial: "", giro: null, logoUrl: null, telefono: null,
    emailContacto: null, web: null, direccion: null, ciudad: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    fetch("/api/empresa/perfil")
      .then(r => r.json())
      .then((j: ApiResponse<EmpresaData>) => {
        if (j.data) { setData(j.data); setForm({ ...j.data }) }
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
            <label className="mb-1.5 block text-xs font-medium text-sl-muted">URL del logotipo</label>
            <div className="flex items-center gap-3">
              {form.logoUrl ? (
                <img
                  src={form.logoUrl}
                  alt="Logo"
                  className="h-12 w-12 shrink-0 rounded-lg border border-sl-border bg-white object-contain p-1"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-sl-border/50 bg-sl-bg-dark/40 text-xs text-sl-muted">
                  Logo
                </div>
              )}
              <input
                value={form.logoUrl ?? ""}
                onChange={e => set("logoUrl", e.target.value)}
                placeholder="https://ejemplo.cl/logo.png"
                className="flex-1 rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
              />
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
          <span className={`text-sm font-medium ${msg.ok ? "text-sl-success" : "text-sl-danger"}`}>
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
