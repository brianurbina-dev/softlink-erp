"use client"

import { useState, useEffect, useRef } from "react"
import {
  Shield,
  Key,
  Upload,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  FileKey,
  Building2,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ConfigState {
  proveedor: "simpleapi" | "yamt"
  ambiente: "certificacion" | "produccion"
  apiKeyConfigurado: boolean
  apiKeyMasked: string | null
  certificadoConfigurado: boolean
  certificadoNombre: string | null
  rutEmpresa: string
  rutCertificado: string
  actividadesEconomicas: number[]
}

type TestStatus = "idle" | "loading" | "ok" | "error"

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<ConfigState | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(true)

  const [ambiente, setAmbiente] = useState<"certificacion" | "produccion">("certificacion")
  const [rutEmpresa, setRutEmpresa] = useState("")
  const [rutCertificado, setRutCertificado] = useState("")
  const [actividadesInput, setActividadesInput] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [showApiKey, setShowApiKey] = useState(false)
  const [certBase64, setCertBase64] = useState<string | null>(null)
  const [certNombre, setCertNombre] = useState<string | null>(null)
  const [certPassword, setCertPassword] = useState("")
  const [showCertPass, setShowCertPass] = useState(false)

  const [saving, setSaving] = useState(false)
  const [testStatus, setTestStatus] = useState<TestStatus>("idle")
  const [testMsg, setTestMsg] = useState("")
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const certRef = useRef<HTMLInputElement>(null)

  function notify(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    fetch("/api/dte/config")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setConfig(j.data)
          setAmbiente(j.data.ambiente ?? "certificacion")
          setRutEmpresa(j.data.rutEmpresa ?? "")
          setRutCertificado(j.data.rutCertificado ?? "")
          setActividadesInput((j.data.actividadesEconomicas ?? []).join(", "))
        }
      })
      .finally(() => setLoadingConfig(false))
  }, [])

  async function handleCertUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (certRef.current) certRef.current.value = ""

    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ""
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    const base64 = btoa(binary)
    setCertBase64(base64)
    setCertNombre(file.name)
  }

  async function save() {
    setSaving(true)
    try {
      const parsedCiiu = actividadesInput
        .split(/[,\s]+/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0)

      const payload: Record<string, unknown> = {
        ambiente,
        proveedor: "simpleapi",
        actividadesEconomicas: parsedCiiu,
      }
      if (apiKey.trim())          payload.apiKey = apiKey.trim()
      if (certBase64)             { payload.certificado = certBase64; payload.certificadoNombre = certNombre }
      if (certPassword.trim())    payload.certificadoPassword = certPassword.trim()
      if (rutEmpresa.trim())      payload.rutEmpresa = rutEmpresa.trim()
      if (rutCertificado.trim())  payload.rutCertificado = rutCertificado.trim()

      const res = await fetch("/api/dte/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) return notify(json.error ?? "Error al guardar", false)

      notify("Configuración guardada", true)
      setApiKey("")
      setCertPassword("")
      setCertBase64(null)
      setCertNombre(null)
      setTestStatus("idle")

      const fresh = await fetch("/api/dte/config").then((r) => r.json())
      if (fresh.data) {
        setConfig(fresh.data)
        setAmbiente(fresh.data.ambiente)
        setActividadesInput((fresh.data.actividadesEconomicas ?? []).join(", "))
      }
    } finally {
      setSaving(false)
    }
  }

  async function testConexion() {
    setTestStatus("loading")
    setTestMsg("")
    try {
      const res = await fetch("/api/dte/config/test", { method: "POST" })
      const json = await res.json()
      if (!res.ok) {
        setTestStatus("error")
        setTestMsg(json.error ?? "Error de conexión")
      } else {
        setTestStatus("ok")
        setTestMsg(json.data?.mensaje ?? "Conexión exitosa")
      }
    } catch {
      setTestStatus("error")
      setTestMsg("No se pudo conectar con el servidor")
    }
  }

  const hasPendingChanges =
    !!apiKey ||
    !!certBase64 ||
    !!certPassword ||
    ambiente !== (config?.ambiente ?? "certificacion") ||
    rutEmpresa !== (config?.rutEmpresa ?? "") ||
    rutCertificado !== (config?.rutCertificado ?? "") ||
    actividadesInput !== (config?.actividadesEconomicas ?? []).join(", ")

  if (loadingConfig) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-sl-muted" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-page-title text-sl-text">Configuración</h1>
        <p className="mt-0.5 text-sm text-sl-muted">Integración con el SII vía SimpleAPI (ChileSystems)</p>
      </div>

      {/* Sección: Ambiente */}
      <div className="rounded-card border border-sl-border bg-sl-bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-sl-purple" />
          <h2 className="text-sm font-semibold text-sl-text">Ambiente DTE</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(["certificacion", "produccion"] as const).map((env) => (
            <button
              key={env}
              onClick={() => setAmbiente(env)}
              className={cn(
                "rounded-lg border p-3.5 text-left transition-colors",
                ambiente === env
                  ? "border-sl-purple bg-sl-purple/[0.08] text-sl-text"
                  : "border-sl-border text-sl-muted hover:border-sl-border/80 hover:text-sl-text"
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn(
                  "h-2 w-2 rounded-full",
                  env === "produccion" ? "bg-sl-success" : "bg-sl-warning"
                )} />
                <span className="text-sm font-medium capitalize">{env}</span>
              </div>
              <p className="mt-1 text-xs text-sl-muted">
                {env === "certificacion"
                  ? "Para pruebas y desarrollo. Los DTEs no tienen validez legal."
                  : "Ambiente real del SII. Los DTEs tienen validez legal y tributaria."}
              </p>
            </button>
          ))}
        </div>

        {ambiente === "produccion" && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-sl-warning/30 bg-sl-warning/[0.07] p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sl-warning" />
            <p className="text-xs text-sl-warning">
              El ambiente de <strong>Producción</strong> emite documentos tributarios reales ante el SII.
              Asegúrate de tener el certificado digital vigente antes de activarlo.
            </p>
          </div>
        )}
      </div>

      {/* Sección: Identificación */}
      <div className="rounded-card border border-sl-border bg-sl-bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-sl-purple" />
          <h2 className="text-sm font-semibold text-sl-text">Identificación</h2>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-sl-muted">RUT Empresa</label>
            <input
              type="text"
              value={rutEmpresa}
              onChange={(e) => setRutEmpresa(e.target.value)}
              placeholder="12345678-9"
              className="w-full rounded-lg border border-sl-border bg-sl-bg-card py-2 pl-3 pr-3 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted font-mono"
            />
            <p className="mt-1.5 text-xs text-sl-muted">RUT con el que opera la empresa (sin puntos, con guión).</p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-sl-muted">RUT Certificado</label>
            <input
              type="text"
              value={rutCertificado}
              onChange={(e) => setRutCertificado(e.target.value)}
              placeholder="12345678-9"
              className="w-full rounded-lg border border-sl-border bg-sl-bg-card py-2 pl-3 pr-3 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted font-mono"
            />
            <p className="mt-1.5 text-xs text-sl-muted">
              RUT del titular del certificado digital (.p12). Puede ser distinto al RUT empresa
              si el certificado fue emitido a nombre de otra persona.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-sl-muted">
              Actividades Económicas (CIIU)
            </label>
            <input
              type="text"
              value={actividadesInput}
              onChange={(e) => setActividadesInput(e.target.value)}
              placeholder="620200, 631100"
              className="w-full rounded-lg border border-sl-border bg-sl-bg-card py-2 pl-3 pr-3 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted font-mono"
            />
            <p className="mt-1.5 text-xs text-sl-muted">
              Códigos CIIU del SII separados por coma. Requeridos por el SII para emitir DTE.
              Ej: <span className="font-mono text-sl-text/70">620200</span> (desarrollo de software).
            </p>
          </div>
        </div>
      </div>

      {/* Sección: API Key SimpleAPI */}
      <div className="rounded-card border border-sl-border bg-sl-bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Key className="h-4 w-4 text-sl-purple" />
          <h2 className="text-sm font-semibold text-sl-text">Credenciales SimpleAPI</h2>
          {config?.apiKeyConfigurado && (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-sl-success/[0.12] px-2 py-0.5 text-xs text-sl-success">
              <CheckCircle className="h-3 w-3" /> Configurado
            </span>
          )}
        </div>

        {config?.apiKeyMasked && (
          <div className="mb-3 rounded-lg border border-sl-border/60 bg-sl-bg-dark/40 px-3 py-2.5">
            <p className="text-xs text-sl-muted">API Key actual</p>
            <p className="mt-0.5 font-mono text-sm text-sl-text">{config.apiKeyMasked}</p>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-medium text-sl-muted">
            {config?.apiKeyConfigurado ? "Nuevo API Key (dejar vacío para no cambiar)" : "API Key"}
          </label>
          <div className="relative">
            <input
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full rounded-lg border border-sl-border bg-sl-bg-card py-2 pl-3 pr-10 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted font-mono"
            />
            <button
              type="button"
              onClick={() => setShowApiKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sl-muted transition-colors hover:text-sl-text"
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-sl-muted">
            Obtén tu API Key en el portal de{" "}
            <span className="text-sl-purple-light">ChileSystems — SimpleAPI</span>.
          </p>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={testConexion}
            disabled={testStatus === "loading" || !config?.apiKeyConfigurado}
            className="flex items-center gap-1.5 rounded-lg border border-sl-border px-4 py-2 text-sm text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-text disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testStatus === "loading" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Shield className="h-3.5 w-3.5" />
            )}
            Probar conexión
          </button>

          {testStatus !== "idle" && testStatus !== "loading" && (
            <div className={cn(
              "flex items-center gap-1.5 text-xs",
              testStatus === "ok" ? "text-sl-success" : "text-sl-danger"
            )}>
              {testStatus === "ok"
                ? <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                : <XCircle className="h-3.5 w-3.5 shrink-0" />}
              {testMsg}
            </div>
          )}

          {!config?.apiKeyConfigurado && (
            <p className="text-xs text-sl-muted">Guarda un API Key primero</p>
          )}
        </div>
      </div>

      {/* Sección: Certificado Digital */}
      <div className="rounded-card border border-sl-border bg-sl-bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <FileKey className="h-4 w-4 text-sl-purple" />
          <h2 className="text-sm font-semibold text-sl-text">Certificado Digital</h2>
          {config?.certificadoConfigurado && (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-sl-success/[0.12] px-2 py-0.5 text-xs text-sl-success">
              <CheckCircle className="h-3 w-3" /> Cargado
            </span>
          )}
        </div>

        {config?.certificadoNombre && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-sl-border/60 bg-sl-bg-dark/40 px-3 py-2.5">
            <FileKey className="h-4 w-4 shrink-0 text-sl-muted" />
            <div>
              <p className="text-xs text-sl-muted">Certificado actual</p>
              <p className="mt-0.5 text-sm text-sl-text">{config.certificadoNombre}</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-sl-muted">
              {config?.certificadoConfigurado ? "Reemplazar certificado (.p12)" : "Certificado (.p12)"}
            </label>
            <button
              onClick={() => certRef.current?.click()}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border px-4 py-3 text-sm transition-colors",
                certBase64
                  ? "border-sl-purple/50 bg-sl-purple/[0.06] text-sl-purple-light"
                  : "border-dashed border-sl-border text-sl-muted hover:border-sl-border/80 hover:text-sl-text"
              )}
            >
              <Upload className="h-4 w-4 shrink-0" />
              {certBase64 ? certNombre : "Haz clic para seleccionar archivo .p12"}
            </button>
            <input
              ref={certRef}
              type="file"
              accept=".p12,.pfx"
              className="hidden"
              onChange={handleCertUpload}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-sl-muted">
              {config?.certificadoConfigurado
                ? "Contraseña del certificado (dejar vacío para no cambiar)"
                : "Contraseña del certificado"}
            </label>
            <div className="relative">
              <input
                type={showCertPass ? "text" : "password"}
                value={certPassword}
                onChange={(e) => setCertPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-sl-border bg-sl-bg-card py-2 pl-3 pr-10 text-sm text-sl-text outline-none focus:border-sl-purple placeholder:text-sl-muted"
              />
              <button
                type="button"
                onClick={() => setShowCertPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sl-muted transition-colors hover:text-sl-text"
              >
                {showCertPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-sl-muted">
          El certificado digital (.p12) es emitido por el SII. Se almacena cifrado y se usa
          para firmar electrónicamente cada DTE antes de enviarlo al SII.
        </p>
      </div>

      {/* Botón guardar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-sl-muted">
          {hasPendingChanges ? "Tienes cambios sin guardar" : "Sin cambios pendientes"}
        </p>
        <button
          onClick={save}
          disabled={saving || !hasPendingChanges}
          className="flex items-center gap-2 rounded-lg bg-sl-purple px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sl-purple-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Guardando..." : "Guardar configuración"}
        </button>
      </div>

      {toast && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-xl",
          toast.ok ? "bg-sl-success text-white" : "bg-sl-danger text-white"
        )}>
          {toast.ok
            ? <CheckCircle className="h-4 w-4 shrink-0" />
            : <AlertTriangle className="h-4 w-4 shrink-0" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
