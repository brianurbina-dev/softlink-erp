"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, X, Trash2, Pencil, CheckCircle, AlertTriangle, Shield, User as UserIcon, KeyRound } from "lucide-react"
import { cn } from "@/lib/utils"
import { SECCIONES_ERP } from "@/lib/permisos"
import type { ApiResponse } from "@/types"

interface UsuarioRow {
  id: string
  rol: string
  permisos: string[]
  activo: boolean
  usuario: { id: string; email: string; nombre: string; creadoEn: string }
}

const EMPTY = { email: "", nombre: "", password: "", rol: "usuario" as "admin" | "usuario", permisos: [] as string[] }

function initials(nombre: string) {
  return nombre.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
}

export default function UsuariosEmpresaPage() {
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<"crear" | "editar" | "password" | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [newPassword, setNewPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function notify(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/empresa/usuarios")
      const j = await res.json() as ApiResponse<UsuarioRow[]>
      if (res.ok) setUsuarios(j.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openCrear() { setForm(EMPTY); setEditingId(null); setModal("crear") }
  function openEditar(u: UsuarioRow) {
    setForm({ ...EMPTY, rol: u.rol as "admin" | "usuario", permisos: [...u.permisos] })
    setEditingId(u.id)
    setModal("editar")
  }
  function openPassword(u: UsuarioRow) { setNewPassword(""); setEditingId(u.id); setModal("password") }
  function closeModal() { setModal(null); setEditingId(null) }

  function togglePermiso(key: string) {
    setForm(f => ({
      ...f,
      permisos: f.permisos.includes(key) ? f.permisos.filter(p => p !== key) : [...f.permisos, key],
    }))
  }

  async function save() {
    if (modal === "crear" && (!form.email || !form.nombre || !form.password)) {
      return notify("Email, nombre y contraseña son requeridos", false)
    }
    setSaving(true)
    try {
      if (modal === "crear") {
        const res = await fetch("/api/empresa/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        const j = await res.json()
        if (!res.ok) { notify(j.error ?? "Error al crear usuario", false); return }
        notify("Usuario creado. Comparte sus credenciales.", true)
      } else if (modal === "editar" && editingId) {
        const res = await fetch(`/api/empresa/usuarios/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rol: form.rol, permisos: form.permisos }),
        })
        const j = await res.json()
        if (!res.ok) { notify(j.error ?? "Error al actualizar", false); return }
        notify("Usuario actualizado", true)
      }
      closeModal()
      load()
    } finally {
      setSaving(false)
    }
  }

  async function changePassword() {
    if (!newPassword || newPassword.length < 6) return notify("La contraseña debe tener al menos 6 caracteres", false)
    if (!editingId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/empresa/usuarios/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      })
      const j = await res.json()
      if (!res.ok) { notify(j.error ?? "Error al cambiar contraseña", false); return }
      notify("Contraseña actualizada", true)
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  async function toggleActivo(u: UsuarioRow) {
    const res = await fetch(`/api/empresa/usuarios/${u.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !u.activo }),
    })
    const j = await res.json()
    if (!res.ok) { notify(j.error ?? "Error al cambiar estado", false); return }
    setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, activo: !x.activo } : x))
  }

  async function del(u: UsuarioRow) {
    if (!confirm(`¿Eliminar el acceso de ${u.usuario.nombre} a esta empresa?`)) return
    const res = await fetch(`/api/empresa/usuarios/${u.id}`, { method: "DELETE" })
    const j = await res.json()
    if (!res.ok) { notify(j.error ?? "Error al eliminar", false); return }
    notify("Acceso eliminado", true)
    load()
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-page-title text-sl-text">Usuarios</h1>
          <p className="mt-0.5 text-sm text-sl-muted">Gestión de acceso para tu empresa</p>
        </div>
        <button
          onClick={openCrear}
          className="flex items-center gap-1.5 rounded-lg bg-sl-purple px-4 py-2 text-sm font-medium text-white hover:bg-sl-purple-dark"
        >
          <Plus className="h-4 w-4" />
          Agregar usuario
        </button>
      </div>

      <div className="overflow-hidden rounded-card border border-sl-border bg-sl-bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sl-border">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted">Usuario</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted">Rol</th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted md:table-cell">Acceso</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-sl-muted">Estado</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-sl-muted">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-12 text-center text-sm text-sl-muted">Cargando...</td></tr>
            ) : usuarios.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-sm text-sl-muted">Sin usuarios registrados en esta empresa</td></tr>
            ) : (
              usuarios.map(u => (
                <tr key={u.id} className="border-b border-sl-border/50 last:border-0 hover:bg-sl-purple/[0.03]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sl-purple-dark text-xs font-semibold text-white">
                        {initials(u.usuario.nombre)}
                      </div>
                      <div>
                        <p className="font-medium text-sl-text">{u.usuario.nombre}</p>
                        <p className="text-xs text-sl-muted">{u.usuario.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.rol === "admin" ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-sl-purple-light">
                        <Shield className="h-3 w-3" /> Admin
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-sl-muted">
                        <UserIcon className="h-3 w-3" /> Usuario
                      </span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {u.rol === "admin" ? (
                      <span className="text-xs text-sl-muted">Acceso completo</span>
                    ) : u.permisos.length === 0 ? (
                      <span className="text-xs text-sl-warning">Sin secciones asignadas</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {u.permisos.slice(0, 4).map(p => (
                          <span key={p} className="rounded bg-sl-border/80 px-1.5 py-0.5 text-[10px] capitalize text-sl-muted">{p}</span>
                        ))}
                        {u.permisos.length > 4 && (
                          <span className="rounded bg-sl-border/80 px-1.5 py-0.5 text-[10px] text-sl-muted">+{u.permisos.length - 4}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActivo(u)}
                      className={cn("flex items-center gap-1.5 text-xs font-medium transition-colors", u.activo ? "text-sl-success" : "text-sl-muted hover:text-sl-text")}
                    >
                      <div className={cn("h-1.5 w-1.5 rounded-full", u.activo ? "bg-sl-success" : "bg-sl-muted")} />
                      {u.activo ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openPassword(u)} title="Cambiar contraseña" className="rounded p-1.5 text-sl-muted hover:bg-sl-purple/[0.15] hover:text-sl-purple-light">
                        <KeyRound className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => openEditar(u)} title="Editar" className="rounded p-1.5 text-sl-muted hover:bg-sl-purple/[0.15] hover:text-sl-purple-light">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => del(u)} title="Eliminar acceso" className="rounded p-1.5 text-sl-muted hover:bg-sl-danger/[0.15] hover:text-sl-danger">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!loading && usuarios.length > 0 && (
          <div className="border-t border-sl-border/50 px-4 py-2.5 text-xs text-sl-muted">
            {usuarios.length} usuario{usuarios.length !== 1 ? "s" : ""} en esta empresa
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      {(modal === "crear" || modal === "editar") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-card border border-sl-border bg-sl-bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-sl-border px-5 py-4">
              <h2 className="font-medium text-sl-text">{modal === "crear" ? "Agregar usuario" : "Editar usuario"}</h2>
              <button onClick={closeModal} className="text-sl-muted hover:text-sl-text"><X className="h-4 w-4" /></button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto">
              <div className="space-y-4 p-5">
                {modal === "crear" && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-sl-muted">Nombre <span className="text-sl-danger">*</span></label>
                      <input
                        value={form.nombre}
                        onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                        placeholder="Juan López"
                        autoFocus
                        className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-sl-muted">Email <span className="text-sl-danger">*</span></label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="juan@empresa.cl"
                        className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-sl-muted">Contraseña inicial <span className="text-sl-danger">*</span></label>
                      <input
                        type="password"
                        value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
                      />
                      <p className="mt-1 text-xs text-sl-muted">Comparte estas credenciales con el usuario para que acceda al sistema</p>
                    </div>
                  </>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-sl-muted">Rol</label>
                  <select
                    value={form.rol}
                    onChange={e => setForm(f => ({ ...f, rol: e.target.value as "admin" | "usuario" }))}
                    className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple"
                  >
                    <option value="admin">Administrador — acceso completo</option>
                    <option value="usuario">Usuario — acceso restringido</option>
                  </select>
                </div>

                {form.rol === "usuario" && (
                  <div>
                    <label className="mb-2 block text-xs font-medium text-sl-muted">Secciones con acceso</label>
                    <div className="space-y-2">
                      {SECCIONES_ERP.map(s => (
                        <label key={s.key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-sl-border/60 p-3 transition-colors hover:border-sl-purple/40 hover:bg-sl-purple/[0.04]">
                          <input
                            type="checkbox"
                            checked={form.permisos.includes(s.key)}
                            onChange={() => togglePermiso(s.key)}
                            className="mt-0.5 accent-sl-purple"
                          />
                          <div>
                            <p className="text-sm font-medium text-sl-text">{s.label}</p>
                            <p className="text-xs text-sl-muted">{s.descripcion}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-sl-border px-5 py-4">
              <button onClick={closeModal} className="rounded-lg border border-sl-border px-4 py-2 text-sm text-sl-muted hover:text-sl-text">Cancelar</button>
              <button onClick={save} disabled={saving} className="rounded-lg bg-sl-purple px-4 py-2 text-sm font-medium text-white hover:bg-sl-purple-dark disabled:opacity-50">
                {saving ? "Guardando..." : modal === "crear" ? "Crear usuario" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cambiar contraseña */}
      {modal === "password" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-card border border-sl-border bg-sl-bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-sl-border px-5 py-4">
              <h2 className="font-medium text-sl-text">Cambiar contraseña</h2>
              <button onClick={closeModal} className="text-sl-muted hover:text-sl-text"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5">
              <label className="mb-1.5 block text-xs font-medium text-sl-muted">Nueva contraseña</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoFocus
                className="w-full rounded-lg border border-sl-border bg-sl-bg-card px-3 py-2 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
              />
              <p className="mt-1.5 text-xs text-sl-muted">El usuario deberá usar esta contraseña en su próximo inicio de sesión</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-sl-border px-5 py-4">
              <button onClick={closeModal} className="rounded-lg border border-sl-border px-4 py-2 text-sm text-sl-muted hover:text-sl-text">Cancelar</button>
              <button onClick={changePassword} disabled={saving} className="rounded-lg bg-sl-purple px-4 py-2 text-sm font-medium text-white hover:bg-sl-purple-dark disabled:opacity-50">
                {saving ? "Guardando..." : "Cambiar contraseña"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={cn("fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-xl", toast.ok ? "bg-sl-success text-white" : "bg-sl-danger text-white")}>
          {toast.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
