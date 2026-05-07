import React from "react"
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PdfEmisor {
  rut: string
  razonSocial: string
  giro: string
  direccion: string
  ciudad: string
  telefono: string
  numeroResolucion: number
  fechaResolucion: string
  logoUrl?: string
}

export interface PdfReceptor {
  rut?: string
  razonSocial?: string
  giro?: string
  direccion?: string
  ciudad?: string
}

export interface PdfItem {
  descripcion: string
  cantidad: number
  precioUnitario: number
  monto: number
}

export interface PdfDatosDTE {
  tipo: number
  folio: number
  fecha: Date
  emisor: PdfEmisor
  receptor: PdfReceptor
  items: PdfItem[]
  neto: number
  iva: number
  total: number
  trackId?: string
  tedBarcode?: string
  tipoTraslado?: number
  referenciaFolio?: number
  referenciaTipo?: number
  referenciaRazon?: string
  tipoEjemplar?: "ORIGINAL" | "CEDIBLE"
  isPreview?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMonto(n: number): string {
  const parts = Math.abs(Math.round(n)).toString().match(/\d{1,3}(?=(\d{3})*$)/g)
  return (n < 0 ? "-" : "") + "$ " + (parts ? parts.join(".") : "0")
}

function fmtFecha(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  return `${dd}/${mm}/${d.getFullYear()}`
}

function numeroALetras(total: number): string {
  const n = Math.round(Math.abs(total))
  if (n === 0) return "CERO PESOS"

  const UNIDADES = [
    "", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE",
  ]
  const ESPECIALES = [
    "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE",
    "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE",
  ]
  const DECENAS = [
    "", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA",
    "SESENTA", "SETENTA", "OCHENTA", "NOVENTA",
  ]
  const CENTENAS = [
    "", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS",
    "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS",
  ]

  function menorMil(x: number): string {
    if (x === 0) return ""
    if (x === 100) return "CIEN"
    const c = Math.floor(x / 100)
    const r = x % 100
    const centPart = c > 0 ? CENTENAS[c] : ""
    let decPart = ""
    if (r === 0) {
      decPart = ""
    } else if (r < 10) {
      decPart = UNIDADES[r]
    } else if (r < 20) {
      decPart = ESPECIALES[r - 10]
    } else {
      const d = Math.floor(r / 10)
      const u = r % 10
      if (d === 2 && u > 0) {
        decPart = "VEINTI" + UNIDADES[u]
      } else {
        decPart = DECENAS[d] + (u > 0 ? " Y " + UNIDADES[u] : "")
      }
    }
    return [centPart, decPart].filter(Boolean).join(" ")
  }

  const millones = Math.floor(n / 1_000_000)
  const miles = Math.floor((n % 1_000_000) / 1_000)
  const resto = n % 1_000

  const partes: string[] = []
  if (millones > 0) {
    partes.push(millones === 1 ? "UN MILLON" : menorMil(millones) + " MILLONES")
  }
  if (miles > 0) {
    partes.push(miles === 1 ? "MIL" : menorMil(miles) + " MIL")
  }
  if (resto > 0) {
    partes.push(menorMil(resto))
  }

  return partes.join(" ") + " PESOS"
}

const TIPO_NOMBRES: Record<number, string> = {
  33: "FACTURA ELECTRONICA",
  34: "FACTURA ELECTRONICA EXENTA",
  39: "BOLETA ELECTRONICA",
  52: "GUIA DE DESPACHO ELECTRONICA",
  56: "NOTA DE DEBITO ELECTRONICA",
  61: "NOTA DE CREDITO ELECTRONICA",
}

const TIPO_TRASLADO_NOMBRES: Record<number, string> = {
  1: "Operacion constituye venta",
  2: "Ventas por efectuar",
  3: "Consignaciones",
  4: "Entrega gratuita",
  5: "Traslados internos",
  6: "Otros traslados",
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const RED = "#CC0000"
const BLACK = "#000000"
const DARK = "#1a1a1a"
const MUTED = "#555555"
const LIGHT_BG = "#f7f7f7"

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: DARK,
    padding: "28 36 28 36",
    backgroundColor: "#ffffff",
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: { flexDirection: "row", marginBottom: 10, alignItems: "stretch" },

  headerLogo: { width: 100, paddingRight: 10, justifyContent: "center", alignItems: "flex-start" },
  logoImg: { width: 90, height: 50, objectFit: "contain" },
  headerCenter: { flex: 1, paddingHorizontal: 10, justifyContent: "center" },
  headerLeft: { flex: 1, paddingRight: 12, justifyContent: "center" },
  empresaNombre: { fontSize: 11, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 2 },
  empresaInfo: { fontSize: 7.5, color: MUTED, marginBottom: 1.5 },

  headerBox: {
    width: 180,
    borderWidth: 1.5,
    borderColor: BLACK,
    padding: "10 12",
    alignItems: "center",
    justifyContent: "center",
  },
  headerBoxRut: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: RED,
    textAlign: "center",
    marginBottom: 6,
  },
  headerBoxTipo: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: RED,
    textAlign: "center",
    marginBottom: 10,
  },
  headerBoxFolioRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 4,
  },
  headerBoxFolioLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: RED, textAlign: "center" },
  headerBoxFolio: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: RED,
    textAlign: "center",
  },

  // ── Sección con borde negro ──────────────────────────────────────────────────
  seccion: {
    borderWidth: 1,
    borderColor: BLACK,
    marginBottom: 6,
    padding: "6 8",
  },
  seccionTitulo: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    textTransform: "uppercase",
    marginBottom: 5,
    borderBottomWidth: 0.5,
    borderColor: BLACK,
    paddingBottom: 3,
  },

  // ── Receptor ────────────────────────────────────────────────────────────────
  row: { flexDirection: "row", marginBottom: 2.5 },
  label: { fontSize: 7.5, color: MUTED, width: 68, flexShrink: 0 },
  value: { fontSize: 7.5, color: DARK, flex: 1 },

  // ── Tabla ítems ─────────────────────────────────────────────────────────────
  tableHeader: {
    flexDirection: "row",
    backgroundColor: LIGHT_BG,
    borderBottomWidth: 0.75,
    borderColor: BLACK,
    padding: "3 4",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.4,
    borderColor: "#cccccc",
    padding: "2.5 4",
  },
  tableRowLast: { flexDirection: "row", padding: "2.5 4" },
  colN: { width: 20, fontSize: 7.5, textAlign: "center" },
  colCant: { width: 34, fontSize: 7.5, textAlign: "right" },
  colDesc: { flex: 1, fontSize: 7.5 },
  colPrecio: { width: 70, fontSize: 7.5, textAlign: "right" },
  colMonto: { width: 70, fontSize: 7.5, textAlign: "right" },
  colHeaderText: { fontFamily: "Helvetica-Bold", color: MUTED, fontSize: 7 },

  // ── Referencia ──────────────────────────────────────────────────────────────
  refBox: {
    backgroundColor: LIGHT_BG,
    borderWidth: 0.5,
    borderColor: "#aaaaaa",
    padding: "4 8",
    marginBottom: 6,
  },
  refText: { fontSize: 7.5, color: MUTED },

  // ── Monto en palabras (dentro del footer) ────────────────────────────────────
  montoLetrasCont: {
    borderBottomWidth: 1,
    borderColor: BLACK,
    padding: "5 8",
  },
  montoLetrasText: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: DARK },

  // ── Caja unificada: timbre | totales (50/50) + ejemplar centrado abajo ───────
  cajaFinal: { borderWidth: 1, borderColor: BLACK, marginTop: "auto" },

  // Fila superior: lado a lado
  cajaFinalTop: {
    flexDirection: "row",
  },

  // Mitad izquierda: timbre
  timbreArea: {
    flex: 1,
    padding: "6 8",
    borderRightWidth: 1,
    borderColor: BLACK,
  },

  // Mitad derecha: totales
  totalesArea: {
    flex: 1,
    padding: "6 8",
    justifyContent: "center",
  },
  totalesBox: { },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.4,
    borderColor: "#cccccc",
    paddingVertical: 2,
  },
  totalRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 4,
    marginTop: 2,
  },
  totalLabel: { fontSize: 8, color: MUTED },
  totalValue: { fontSize: 8, color: DARK, textAlign: "right" },
  totalFinalLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: DARK },
  totalFinalValue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: DARK },

  // ORIGINAL / CEDIBLE — fila inferior centrada
  ejemplarFila: {
    borderTopWidth: 1,
    borderColor: BLACK,
    padding: "5 8",
    alignItems: "center",
  },
  ejemplarText: { fontSize: 10, fontFamily: "Helvetica-Bold", color: RED },
  timbreTitulo: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    textTransform: "uppercase",
    marginBottom: 4,
    borderBottomWidth: 0.5,
    borderColor: BLACK,
    paddingBottom: 3,
  },
  timbreRow: { flexDirection: "row", marginBottom: 2 },
  timbreLabel: { fontSize: 7.5, color: MUTED, width: 80 },
  timbreValue: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: DARK },
  timbreVerif: { fontSize: 7, color: DARK, marginTop: 4 },
  timbreBarcode: { width: "100%", height: 50, objectFit: "contain", marginVertical: 4 },

  // ── Watermark (vista previa) ─────────────────────────────────────────────────
  watermarkWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  watermarkText: {
    fontSize: 52,
    fontFamily: "Helvetica-Bold",
    color: "#CC0000",
    opacity: 0.1,
    textAlign: "center",
    transform: "rotate(-42deg)",
    letterSpacing: 4,
  },
})

// ─── Componente ───────────────────────────────────────────────────────────────

function DTEDocument({ d }: { d: PdfDatosDTE }) {
  const tipNombre = TIPO_NOMBRES[d.tipo] ?? `DOCUMENTO TIPO ${d.tipo}`
  const esAfecta = [33, 56].includes(d.tipo)
  const esBoleta = d.tipo === 39
  const esGuia = d.tipo === 52
  const mostrarEjemplar = [33, 34, 52, 56, 61].includes(d.tipo)
  const ejemplar = d.tipoEjemplar ?? "ORIGINAL"

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* ── Watermark vista previa ── */}
        {d.isPreview && (
          <View style={S.watermarkWrap}>
            <Text style={S.watermarkText}>SIN VALIDEZ</Text>
            <Text style={S.watermarkText}>ANTE EL SII</Text>
          </View>
        )}

        {/* ── Header ── */}
        <View style={S.header}>
          {/* Izquierda: logo (solo si existe) */}
          {d.emisor.logoUrl ? (
            <View style={S.headerLogo}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={d.emisor.logoUrl} style={S.logoImg} />
            </View>
          ) : null}

          {/* Centro: datos de la empresa */}
          <View style={d.emisor.logoUrl ? S.headerCenter : S.headerLeft}>
            <Text style={S.empresaNombre}>{d.emisor.razonSocial}</Text>
            {d.emisor.giro ? <Text style={S.empresaInfo}>{d.emisor.giro}</Text> : null}
            {d.emisor.direccion ? (
              <Text style={S.empresaInfo}>
                {d.emisor.direccion}{d.emisor.ciudad ? `, ${d.emisor.ciudad}` : ""}
              </Text>
            ) : null}
            {d.emisor.telefono ? (
              <Text style={S.empresaInfo}>Tel: {d.emisor.telefono}</Text>
            ) : null}
          </View>

          {/* Derecha: caja negra con RUT (rojo), tipo (rojo), N° folio en una línea */}
          <View style={S.headerBox}>
            <Text style={S.headerBoxRut}>R.U.T.: {d.emisor.rut}</Text>
            <Text style={S.headerBoxTipo}>{tipNombre}</Text>
            <View style={S.headerBoxFolioRow}>
              <Text style={S.headerBoxFolioLabel}>N°</Text>
              <Text style={S.headerBoxFolio}>{d.folio}</Text>
            </View>
          </View>
        </View>

        {/* ── Receptor ── */}
        <View style={S.seccion}>
          <Text style={S.seccionTitulo}>Datos del Receptor</Text>
          <View style={S.row}>
            <Text style={S.label}>Fecha:</Text>
            <Text style={S.value}>{fmtFecha(d.fecha)}</Text>
            {d.receptor.rut && !esBoleta ? (
              <>
                <Text style={[S.label, { width: 36 }]}>R.U.T.:</Text>
                <Text style={S.value}>{d.receptor.rut}</Text>
              </>
            ) : null}
          </View>
          {d.receptor.razonSocial ? (
            <View style={S.row}>
              <Text style={S.label}>Señor(es):</Text>
              <Text style={S.value}>{d.receptor.razonSocial}</Text>
            </View>
          ) : null}
          {d.receptor.giro && !esBoleta ? (
            <View style={S.row}>
              <Text style={S.label}>Giro:</Text>
              <Text style={S.value}>{d.receptor.giro}</Text>
            </View>
          ) : null}
          {d.receptor.direccion ? (
            <View style={S.row}>
              <Text style={S.label}>Direccion:</Text>
              <Text style={S.value}>
                {d.receptor.direccion}{d.receptor.ciudad ? `, ${d.receptor.ciudad}` : ""}
              </Text>
            </View>
          ) : null}
          {esGuia && d.tipoTraslado ? (
            <View style={S.row}>
              <Text style={S.label}>Tipo traslado:</Text>
              <Text style={S.value}>
                {d.tipoTraslado} — {TIPO_TRASLADO_NOMBRES[d.tipoTraslado] ?? ""}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Referencia (notas) ── */}
        {d.referenciaFolio ? (
          <View style={S.refBox}>
            <Text style={S.refText}>
              Referencia: {d.referenciaTipo ? `Tipo ${d.referenciaTipo}` : ""} N° {d.referenciaFolio}
              {d.referenciaRazon ? ` — ${d.referenciaRazon}` : ""}
            </Text>
          </View>
        ) : null}

        {/* ── Tabla ítems ── */}
        <View style={S.seccion}>
          <Text style={S.seccionTitulo}>Detalle</Text>
          {/* Header */}
          <View style={S.tableHeader}>
            <Text style={[S.colN, S.colHeaderText]}>N°</Text>
            <Text style={[S.colCant, S.colHeaderText]}>Cant.</Text>
            <Text style={[S.colDesc, S.colHeaderText]}>Descripcion</Text>
            <Text style={[S.colPrecio, S.colHeaderText]}>P. Unit.</Text>
            <Text style={[S.colMonto, S.colHeaderText]}>Monto</Text>
          </View>
          {/* Rows */}
          {d.items.map((item, i) => {
            const isLast = i === d.items.length - 1
            return (
              <View key={i} style={isLast ? S.tableRowLast : S.tableRow}>
                <Text style={S.colN}>{i + 1}</Text>
                <Text style={S.colCant}>{item.cantidad}</Text>
                <Text style={S.colDesc}>{item.descripcion}</Text>
                <Text style={S.colPrecio}>{fmtMonto(item.precioUnitario)}</Text>
                <Text style={S.colMonto}>{fmtMonto(item.monto)}</Text>
              </View>
            )
          })}
        </View>

        {/* ── Caja unificada pegada al fondo: monto palabras + timbre | totales + ejemplar ── */}
        <View style={S.cajaFinal}>

          {/* Fila monto en palabras */}
          <View style={S.montoLetrasCont}>
            <Text style={S.montoLetrasText}>{numeroALetras(d.total)}</Text>
          </View>

          {/* Fila superior: izquierda timbre | derecha totales */}
          <View style={S.cajaFinalTop}>

            {/* Izquierda — Timbre */}
            <View style={S.timbreArea}>
              <Text style={S.timbreTitulo}>Timbre Electronico SII</Text>
              {d.tedBarcode ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={d.tedBarcode} style={S.timbreBarcode} />
              ) : (
                <>
                  <View style={S.timbreRow}>
                    <Text style={S.timbreLabel}>Resolucion N°:</Text>
                    <Text style={S.timbreValue}>{d.emisor.numeroResolucion} del {d.emisor.fechaResolucion}</Text>
                  </View>
                  {d.trackId ? (
                    <View style={S.timbreRow}>
                      <Text style={S.timbreLabel}>Track ID SII:</Text>
                      <Text style={S.timbreValue}>{d.trackId}</Text>
                    </View>
                  ) : null}
                </>
              )}
              <Text style={S.timbreVerif}>
                Verifique documento en www.sii.cl
              </Text>
            </View>

            {/* Derecha — Totales */}
            <View style={S.totalesArea}>
              <View style={S.totalesBox}>
                {!esBoleta ? (
                  <View style={S.totalRow}>
                    <Text style={S.totalLabel}>Monto Neto</Text>
                    <Text style={S.totalValue}>{fmtMonto(d.neto)}</Text>
                  </View>
                ) : null}
                {esAfecta || esBoleta ? (
                  <View style={S.totalRow}>
                    <Text style={S.totalLabel}>IVA 19%</Text>
                    <Text style={S.totalValue}>{fmtMonto(d.iva)}</Text>
                  </View>
                ) : null}
                {!esAfecta && !esBoleta && d.tipo !== 56 ? (
                  <View style={S.totalRow}>
                    <Text style={S.totalLabel}>Monto Exento</Text>
                    <Text style={S.totalValue}>{fmtMonto(d.neto)}</Text>
                  </View>
                ) : null}
                <View style={S.totalRowLast}>
                  <Text style={S.totalFinalLabel}>TOTAL</Text>
                  <Text style={S.totalFinalValue}>{fmtMonto(d.total)}</Text>
                </View>
              </View>
            </View>

          </View>

          {/* Fila inferior — ORIGINAL / CEDIBLE centrado */}
          {mostrarEjemplar ? (
            <View style={S.ejemplarFila}>
              <Text style={S.ejemplarText}>{ejemplar}</Text>
            </View>
          ) : null}

        </View>

      </Page>
    </Document>
  )
}

// ─── API pública ──────────────────────────────────────────────────────────────

export async function generarPdfDTE(datos: PdfDatosDTE): Promise<Buffer> {
  const buffer = await renderToBuffer(<DTEDocument d={datos} />)
  return Buffer.from(buffer)
}
