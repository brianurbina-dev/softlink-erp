/** Roles del sistema */
export type RolGlobal = "super_admin" | "admin" | "contador" | "vendedor" | "bodeguero" | "user"

/** Planes de suscripción */
export type Plan = "starter" | "pyme" | "pro"

/** Ambientes DTE */
export type AmbienteDTE = "certificacion" | "produccion"

/** Proveedores DTE soportados */
export type ProveedorDTE = "simpleapi" | "yamt"

/** Result pattern para servicios — nunca lanzar excepciones */
export type Result<T, E = Error> = { ok: true; data: T } | { ok: false; error: E }

/** Respuesta estándar de API routes */
export type ApiResponse<T = unknown> = {
  data?: T
  error?: string
  meta?: Record<string, unknown>
}
