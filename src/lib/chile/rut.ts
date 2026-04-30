/** Valida RUT chileno usando algoritmo módulo 11. */
export function validarRut(rut: string): boolean {
  const clean = rut.replace(/[.\-]/g, "").toUpperCase()
  if (clean.length < 2) return false

  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)

  if (!/^\d+$/.test(body)) return false

  let sum = 0
  let multiplier = 2

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier
    multiplier = multiplier === 7 ? 2 : multiplier + 1
  }

  const expected = 11 - (sum % 11)
  const expectedDv = expected === 11 ? "0" : expected === 10 ? "K" : String(expected)

  return dv === expectedDv
}

/** Formatea RUT para almacenamiento: "12345678-9" */
export function formatRutStorage(rut: string): string {
  const clean = rut.replace(/[.\-]/g, "").toUpperCase()
  return `${clean.slice(0, -1)}-${clean.slice(-1)}`
}

/** Formatea RUT para display: "12.345.678-9" */
export function formatRutDisplay(rut: string): string {
  const clean = rut.replace(/[.\-]/g, "").toUpperCase()
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`
}
