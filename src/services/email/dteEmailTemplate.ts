export interface DteEmailTemplateParams {
  tipoLabel: string
  folio: number
  fecha: Date
  emisorNombre: string
  emisorRut: string
  receptorNombre: string
  receptorRut: string
  items: {
    descripcion: string
    cantidad: number
    precioUnitario: number
    monto: number
  }[]
  neto: number
  iva: number
  total: number
  trackId: string
  appUrl: string
  documentoTipoPath: string
}

function fmt(n: number): string {
  return "$" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

function fmtFecha(d: Date): string {
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Santiago",
  })
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function buildDteEmailHtml(p: DteEmailTemplateParams): string {
  const displayItems = p.items.slice(0, 12)
  const extraCount = p.items.length - displayItems.length

  const itemRows = displayItems
    .map(
      (item, i) => `
    <tr style="background:${i % 2 === 0 ? "#ffffff" : "#fafafa"};">
      <td style="padding:10px 14px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #f0f0f8;max-width:240px;">${esc(item.descripcion)}</td>
      <td align="center" style="padding:10px 8px;font-size:13px;color:#6b6b88;border-bottom:1px solid #f0f0f8;white-space:nowrap;">${item.cantidad}</td>
      <td align="right" style="padding:10px 14px;font-size:13px;color:#6b6b88;border-bottom:1px solid #f0f0f8;white-space:nowrap;">${fmt(item.precioUnitario)}</td>
      <td align="right" style="padding:10px 14px;font-size:13px;font-weight:500;color:#1a1a2e;border-bottom:1px solid #f0f0f8;white-space:nowrap;">${fmt(item.monto)}</td>
    </tr>`
    )
    .join("")

  const extraRow =
    extraCount > 0
      ? `<tr><td colspan="4" align="center" style="padding:8px;font-size:12px;color:#888899;font-style:italic;">... y ${extraCount} ítem${extraCount > 1 ? "s" : ""} más</td></tr>`
      : ""

  const netoRow =
    p.iva > 0
      ? `<tr>
      <td style="padding:4px 16px 4px 0;font-size:13px;color:#6b6b88;">Neto</td>
      <td align="right" style="padding:4px 0 4px 16px;font-size:13px;color:#6b6b88;white-space:nowrap;">${fmt(p.neto)}</td>
    </tr>`
      : ""

  const ivaRow =
    p.iva > 0
      ? `<tr>
      <td style="padding:4px 16px 4px 0;font-size:13px;color:#6b6b88;">IVA (19%)</td>
      <td align="right" style="padding:4px 0 4px 16px;font-size:13px;color:#6b6b88;white-space:nowrap;">${fmt(p.iva)}</td>
    </tr>`
      : ""

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${esc(p.tipoLabel)} N° ${p.folio}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <span style="display:none;font-size:1px;color:#f4f4f8;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${esc(p.tipoLabel)} N° ${p.folio} de ${esc(p.emisorNombre)} — Total: ${fmt(p.total)}
  </span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f8;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
          style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header purple -->
          <tr>
            <td style="background:linear-gradient(135deg,#534AB7 0%,#7F77DD 100%);padding:28px 40px;">
              <table role="presentation" width="100%"><tr>
                <td>
                  <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.3px;">
                    <span style="opacity:0.65;">Soft</span>link ERP
                  </span>
                </td>
                <td align="right">
                  <span style="color:rgba(255,255,255,0.6);font-size:11px;letter-spacing:0.8px;text-transform:uppercase;">Documento Tributario Electrónico</span>
                </td>
              </tr></table>
            </td>
          </tr>

          <!-- Document banner -->
          <tr>
            <td style="padding:32px 40px 20px;">
              <table role="presentation" width="100%"><tr>
                <td style="border-left:3px solid #7F77DD;padding-left:16px;">
                  <div style="font-size:11px;color:#888899;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:6px;">${esc(p.tipoLabel)}</div>
                  <div style="font-size:34px;font-weight:800;color:#1a1a2e;line-height:1;letter-spacing:-1px;">N° ${p.folio}</div>
                  <div style="font-size:14px;color:#6b6b88;margin-top:6px;">${fmtFecha(p.fecha)}</div>
                </td>
                <td align="right" style="vertical-align:top;padding-top:4px;">
                  <div style="display:inline-block;background:#f0fdf4;border:1px solid #86efac;border-radius:20px;padding:6px 14px;">
                    <span style="color:#16a34a;font-size:12px;font-weight:600;">&#10003; Emitido ante el SII</span>
                  </div>
                </td>
              </tr></table>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 40px;"><div style="height:1px;background:#e2e2ee;"></div></td></tr>

          <!-- Emisor / Receptor -->
          <tr>
            <td style="padding:20px 40px;">
              <table role="presentation" width="100%" style="border:1px solid #e2e2ee;border-radius:8px;border-collapse:collapse;">
                <tr>
                  <td style="padding:16px 20px;vertical-align:top;width:50%;border-right:1px solid #e2e2ee;">
                    <div style="font-size:10px;color:#AFA9EC;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px;font-weight:600;">Emisor</div>
                    <div style="font-size:14px;font-weight:600;color:#1a1a2e;line-height:1.4;">${esc(p.emisorNombre)}</div>
                    <div style="font-size:12px;color:#6b6b88;margin-top:3px;">RUT ${esc(p.emisorRut)}</div>
                  </td>
                  <td style="padding:16px 20px;vertical-align:top;width:50%;">
                    <div style="font-size:10px;color:#AFA9EC;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px;font-weight:600;">Receptor</div>
                    <div style="font-size:14px;font-weight:600;color:#1a1a2e;line-height:1.4;">${esc(p.receptorNombre)}</div>
                    <div style="font-size:12px;color:#6b6b88;margin-top:3px;">RUT ${esc(p.receptorRut)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Items -->
          <tr>
            <td style="padding:0 40px 4px;">
              <div style="font-size:10px;color:#888899;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px;font-weight:600;">Detalle</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                style="border:1px solid #e2e2ee;border-radius:8px;overflow:hidden;border-collapse:collapse;">
                <tr style="background:#f8f8fc;">
                  <th align="left" style="padding:10px 14px;font-size:11px;color:#6b6b88;font-weight:600;border-bottom:1px solid #e2e2ee;">Descripción</th>
                  <th align="center" style="padding:10px 8px;font-size:11px;color:#6b6b88;font-weight:600;border-bottom:1px solid #e2e2ee;white-space:nowrap;">Cant.</th>
                  <th align="right" style="padding:10px 14px;font-size:11px;color:#6b6b88;font-weight:600;border-bottom:1px solid #e2e2ee;white-space:nowrap;">P. Unit.</th>
                  <th align="right" style="padding:10px 14px;font-size:11px;color:#6b6b88;font-weight:600;border-bottom:1px solid #e2e2ee;white-space:nowrap;">Total</th>
                </tr>
                ${itemRows}
                ${extraRow}
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding:16px 40px 28px;">
              <table role="presentation" align="right" style="min-width:260px;">
                ${netoRow}
                ${ivaRow}
                <tr><td colspan="2" style="padding:6px 0;"><div style="height:1px;background:#e2e2ee;"></div></td></tr>
                <tr>
                  <td style="padding:8px 16px 0 0;font-size:13px;font-weight:700;color:#1a1a2e;letter-spacing:0.5px;">TOTAL A PAGAR</td>
                  <td align="right" style="padding:8px 0 0 16px;">
                    <span style="font-size:26px;font-weight:800;color:#7F77DD;letter-spacing:-0.5px;">${fmt(p.total)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 40px;"><div style="height:1px;background:#e2e2ee;"></div></td></tr>

          <!-- PDF notice + CTA -->
          <tr>
            <td style="padding:28px 40px;text-align:center;">
              <div style="display:inline-block;background:#f8f8fc;border:1px solid #e2e2ee;border-radius:8px;padding:12px 20px;margin-bottom:20px;">
                <span style="font-size:13px;color:#6b6b88;">&#128206; El PDF oficial de este documento está adjunto a este correo.</span>
              </div>
              <br>
              <a href="${p.appUrl}/dashboard/facturacion/${p.documentoTipoPath}"
                style="display:inline-block;background:#7F77DD;color:#ffffff;text-decoration:none;padding:13px 30px;border-radius:8px;font-weight:600;font-size:14px;letter-spacing:0.2px;">
                Ver en Softlink ERP &#8594;
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8f8fc;border-top:1px solid #e2e2ee;padding:20px 40px;border-radius:0 0 12px 12px;">
              <table role="presentation" width="100%"><tr>
                <td style="vertical-align:top;">
                  <div style="font-size:11px;color:#888899;margin-bottom:5px;">
                    Track ID SII: <strong style="color:#534AB7;">${esc(p.trackId)}</strong>
                  </div>
                  <div style="font-size:11px;color:#aaaabc;line-height:1.6;">
                    Este es un Documento Tributario Electrónico (DTE) con validez legal ante el<br>
                    Servicio de Impuestos Internos de Chile. Generado por <strong>Softlink ERP</strong>.
                  </div>
                </td>
                <td align="right" style="vertical-align:top;padding-left:16px;">
                  <div style="font-size:18px;font-weight:800;color:#AFA9EC;white-space:nowrap;letter-spacing:-0.3px;">
                    <span style="opacity:0.5;">Soft</span>link
                  </div>
                </td>
              </tr></table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
