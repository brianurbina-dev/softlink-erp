"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { loginSchema } from "@/lib/validations/auth"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    const parsed = loginSchema.safeParse({ email, password })
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError("Email o contraseña incorrectos")
        return
      }

      router.push("/dashboard")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="mb-8 text-center">
        <span className="text-2xl font-semibold">
          <span className="text-white">Soft</span>
          <span className="text-sl-purple">link ERP</span>
        </span>
        <p className="mt-2 text-sm text-sl-muted">Inicia sesión en tu cuenta</p>
      </div>

      {/* Card */}
      <div className="rounded-card border border-sl-border bg-sl-bg-card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-sl-text">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@empresa.cl"
              className="w-full rounded-lg border border-sl-border bg-sl-bg-dark px-3 py-2 text-sm text-sl-text placeholder:text-sl-muted/60 focus:border-sl-purple focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-sl-text">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full rounded-lg border border-sl-border bg-sl-bg-dark px-3 py-2 text-sm text-sl-text placeholder:text-sl-muted/60 focus:border-sl-purple focus:outline-none"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-sl-danger/10 px-3 py-2 text-sm text-sl-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-sl-purple px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sl-purple-dark disabled:opacity-60"
          >
            {loading ? "Iniciando sesión..." : "Iniciar sesión"}
          </button>
        </form>
      </div>

      <p className="mt-4 text-center text-sm text-sl-muted">
        ¿Sin cuenta?{" "}
        <Link href="/registro" className="text-sl-purple-light hover:underline">
          Registra tu empresa
        </Link>
      </p>
    </div>
  )
}
