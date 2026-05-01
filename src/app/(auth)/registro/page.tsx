"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { registroSchema } from "@/lib/validations/auth"
import { validarRut, formatRutDisplay } from "@/lib/chile/rut"

export default function RegistroPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [rutEmpresa, setRutEmpresa] = useState("")
  const [rutValido, setRutValido] = useState<boolean | null>(null)

  function handleRutChange(value: string) {
    setRutEmpresa(value)
    if (value.length >= 8) {
      setRutValido(validarRut(value))
    } else {
      setRutValido(null)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")

    const form = new FormData(e.currentTarget)
    const data = {
      nombre: form.get("nombre") as string,
      email: form.get("email") as string,
      password: form.get("password") as string,
      rutEmpresa,
      razonSocial: form.get("razonSocial") as string,
      giro: form.get("giro") as string,
      plan: "starter" as const,
    }

    const parsed = registroSchema.safeParse(data)
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? "Error al registrar")
        return
      }

      // Auto-login después del registro
      const supabase = createClient()
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (loginError) {
        router.push("/login")
        return
      }

      // Establecer empresa activa
      if (json.data?.empresaId) {
        await fetch("/api/auth/empresa", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ empresaId: json.data.empresaId }),
        })
      }

      router.push("/dashboard")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="mb-8 text-center">
        <span className="text-2xl font-semibold">
          <span className="text-white">Soft</span>
          <span className="text-sl-purple">link ERP</span>
        </span>
        <p className="mt-2 text-sm text-sl-muted">Registra tu empresa y comienza hoy</p>
      </div>

      <div className="rounded-card border border-sl-border bg-sl-bg-card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Datos personales */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-sl-muted">
              Tu cuenta
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-sl-text">
                  Nombre completo
                </label>
                <input
                  name="nombre"
                  type="text"
                  required
                  placeholder="Juan Pérez"
                  className="w-full rounded-lg border border-sl-border bg-sl-bg-dark px-3 py-2 text-sm text-sl-text placeholder:text-sl-muted/60 focus:border-sl-purple focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-sl-text">Email</label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="juan@empresa.cl"
                  className="w-full rounded-lg border border-sl-border bg-sl-bg-dark px-3 py-2 text-sm text-sl-text placeholder:text-sl-muted/60 focus:border-sl-purple focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-sl-text">Contraseña</label>
                <input
                  name="password"
                  type="password"
                  required
                  placeholder="Mínimo 8 caracteres"
                  className="w-full rounded-lg border border-sl-border bg-sl-bg-dark px-3 py-2 text-sm text-sl-text placeholder:text-sl-muted/60 focus:border-sl-purple focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Datos empresa */}
          <div className="border-t border-sl-border/60 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-sl-muted">
              Tu empresa
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-sl-text">
                  RUT empresa
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={rutEmpresa}
                    onChange={(e) => handleRutChange(e.target.value)}
                    placeholder="12345678-9"
                    required
                    className={`w-full rounded-lg border bg-sl-bg-dark px-3 py-2 text-sm text-sl-text placeholder:text-sl-muted/60 focus:outline-none ${
                      rutValido === null
                        ? "border-sl-border focus:border-sl-purple"
                        : rutValido
                          ? "border-sl-success"
                          : "border-sl-danger"
                    }`}
                  />
                  {rutValido !== null && (
                    <span className="absolute right-3 top-2.5 text-xs">
                      {rutValido ? (
                        <span className="text-sl-success">✓ válido</span>
                      ) : (
                        <span className="text-sl-danger">✗ inválido</span>
                      )}
                    </span>
                  )}
                </div>
                {rutValido && (
                  <p className="mt-1 text-xs text-sl-muted">{formatRutDisplay(rutEmpresa)}</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-sl-text">
                  Razón social
                </label>
                <input
                  name="razonSocial"
                  type="text"
                  required
                  placeholder="Mi Empresa SpA"
                  className="w-full rounded-lg border border-sl-border bg-sl-bg-dark px-3 py-2 text-sm text-sl-text placeholder:text-sl-muted/60 focus:border-sl-purple focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-sl-text">
                  Giro del negocio
                </label>
                <input
                  name="giro"
                  type="text"
                  required
                  placeholder="Comercio al por menor"
                  className="w-full rounded-lg border border-sl-border bg-sl-bg-dark px-3 py-2 text-sm text-sl-text placeholder:text-sl-muted/60 focus:border-sl-purple focus:outline-none"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-sl-danger/10 px-3 py-2 text-sm text-sl-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || rutValido === false}
            className="w-full rounded-lg bg-sl-purple px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sl-purple-dark disabled:opacity-60"
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>
      </div>

      <p className="mt-4 text-center text-sm text-sl-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-sl-purple-light hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}
