# Mejoras pendientes — Softlink ERP

Ideas y mejoras que surgieron durante el desarrollo pero que no están en el PRD actual.
Se revisan al cerrar cada fase para decidir si se incorporan al roadmap.

---

## ✅ [2026-05-06] Aplicar patrones UX de facturas a boletas, notas y guías — IMPLEMENTADO 07/05/2026
- Módulo relacionado: 2.3 (Boletas), 2.4 (Notas), 2.5 (Guías)
- Descripción: Todo lo implementado en el módulo de facturas (sesiones 3–4 del módulo 9.1) debe replicarse en los otros tres módulos de facturación. El detalle completo de cada mejora y cómo está implementada en facturas se describe a continuación para facilitar el port.
- Prioridad sugerida: media
- Origen: implementado en facturas — pendiente de replicar en los demás módulos

### Detalle técnico — qué hay en facturas y cómo replicarlo

#### 1. Vista previa PDF (borradores)
- **Cómo funciona en facturas:**
  - Botón "Previsualizar PDF" en `/facturas/nueva/page.tsx` y en `/facturas/[id]/editar/page.tsx`
  - También en el listado para borradores (botón en la fila)
  - Al hacer clic: POST a `/api/facturas/preview` con el payload del formulario → devuelve `application/pdf` → `URL.createObjectURL(blob)` → abre `<PdfModal isPreview>` client-side → `URL.revokeObjectURL()` al cerrar
  - El PDF incluye marca de agua diagonal "SIN VALIDEZ / ANTE EL SII" (opacity 0.1, rojo, rotación -42°) implementada en `dtePdfGenerator.tsx` con el flag `isPreview: true` en `PdfDatosDTE`
  - `<PdfModal isPreview>` muestra ícono `ⓘ` en el header que despliega un popover: "Este es un documento de vista previa generado localmente. No tiene ninguna validez ante el SII y no ha sido enviado ni timbrado."
- **Qué crear para replicar:**
  - Boletas: `POST /api/boletas/preview` + `GET /api/boletas/[id]/preview`
  - Guías: `POST /api/guias/preview` + `GET /api/guias/[id]/preview`
  - Notas: integrar dentro del modal de creación (no tiene página separada)
  - El generador PDF (`dtePdfGenerator.tsx`) ya soporta `isPreview` — solo hay que pasarlo

#### 2. Click en fila borrador → navegar a editar
- **Cómo funciona en facturas:**
  - En el `<tr>` del listado: `onClick={() => router.push(\`/facturas/${f.id}/editar\`)}` con `cursor-pointer`
  - El `<td>` de acciones tiene `onClick={(e) => e.stopPropagation()}` para evitar conflicto
  - La página `/facturas/[id]/editar/page.tsx` carga el borrador vía `GET /api/facturas/[id]`, pre-rellena el formulario, permite editar y tiene "Guardar" (`PUT /api/facturas/[id]`) + "Previsualizar PDF" + "Emitir"
- **Qué crear para replicar:**
  - Boletas: `/dashboard/facturacion/boletas/[id]/editar` + `PUT /api/boletas/[id]`
  - Guías: `/dashboard/facturacion/guias/[id]/editar` + `PUT /api/guias/[id]`
  - Notas: abrir el modal de creación pre-cargado con los datos del borrador (sin página separada)

#### 3. Click en fila emitida → modal de detalle
- **Cómo funciona en facturas:**
  - `onClick` en `<tr>` de emitidas llama a `handleVerDetalle(id)` → `GET /api/facturas/[id]` → setDetalle(data)
  - Modal con: header (tipo + folio + badge de estado + botón X), body scrolleable (datos generales + tabla de ítems + totales), footer con acciones
  - **Footer de acciones:** Ver PDF (abre `<PdfModal>`), Descargar PDF (`<a target="_blank">`), Ver XML (abre `<XmlViewerModal>`), Anular (solo si emitida)
  - `GET /api/facturas/[id]` devuelve: todos los campos de la factura + `cliente_razon_social`, `cliente_rut`, `cliente_giro`, `cliente_direccion` (JOIN con clientes) + `items[]` con `descripcion`, `cantidad`, `precio_unitario`, `subtotal`
- **Qué crear para replicar:**
  - Endpoints: `GET /api/boletas/[id]`, `GET /api/guias/[id]`, `GET /api/notas/[id]` — verificar si ya existen y si incluyen ítems
  - El modal es JSX inline en la página (no componente separado) — copiar la estructura del modal de facturas adaptando campos y acciones según el tipo de documento

#### 4. Visor XML con resaltado de sintaxis
- **Cómo funciona en facturas:**
  - Botón `<FileCode2>` en la fila de emitidas y en el footer del modal de detalle → abre `<XmlViewerModal>`
  - `XmlViewerModal` recibe `xmlUrl` y `downloadUrl` → `fetch(xmlUrl)` → pretty-print + syntax highlight con regex → `dangerouslySetInnerHTML` en `<pre>`
  - Endpoint `GET /api/facturas/[id]/xml` → busca en R2 con `buildR2Key(rut, tipo, folio, fecha, "xml")` → `downloadFromR2(key)` → devuelve `text/xml`. Con `?download=1` agrega `Content-Disposition: attachment`
  - El modal tiene un botón `?` que muestra: "Archivo XML correspondiente al Documento Tributario Electrónico (DTE), utilizado para validación, envío y respaldo ante el SII."
- **Qué crear para replicar:**
  - Endpoints: `GET /api/boletas/[id]/xml`, `GET /api/guias/[id]/xml`, `GET /api/notas/[id]/xml` — misma lógica que facturas, solo cambia la tabla de origen
  - `XmlViewerModal` ya existe y es reutilizable — no necesita modificación

## [2026-05-05] Anulación de boleta via nota de crédito
- Módulo relacionado: 2.3 (Boletas electrónicas)
- Descripción: En Chile las boletas no se anulan directamente con el SII — el mecanismo legal es emitir una nota de crédito de boleta (tipo 61) por el monto completo. El botón "Anular" en el listado de boletas debe generar automáticamente esa NC, igual que el flujo de anulación de facturas, pero referenciando una boleta (tipo 39) en lugar de una factura.
- Prioridad sugerida: media
- Origen: consulta del usuario — confirmado por normativa SII

## [2026-05-05] Precio editable al crear boleta
- Módulo relacionado: 2.3 (Boletas electrónicas — interfaz POS)
- Descripción: En la pantalla de nueva boleta (grid de productos + carrito), el precio unitario que viene del catálogo debería poder modificarse manualmente por ítem antes de emitir. Útil para descuentos puntuales o precios acordados que difieren del catálogo.
- Prioridad sugerida: media
- Origen: lo mencionó el usuario durante el desarrollo

---

## [2026-05-01] CRM 5.2 — Seguimiento y actividades por oportunidad
- Módulo relacionado: 5.2 (pospuesto por decisión del usuario)
- Descripción: Registro de actividades por oportunidad (llamadas, reuniones, emails, tareas). Timeline de seguimiento. Fecha de próximo contacto y recordatorios.
- Prioridad sugerida: media
- Origen: decisión de alcance — se optó por implementar solo el pipeline (5.1) y pasar a Reportes
- Notas de implementación:
  - Tabla nueva `crm_actividades`: id, oportunidad_id, tipo (llamada/reunion/email/tarea), descripcion, fecha, completada, creado_en
  - UI: panel de timeline dentro de la vista de detalle de oportunidad
  - Alternativa simple: campo `notas` + `fecha_proximo_contacto` en la tabla `oportunidades` sin tabla adicional

## [2026-05-01] CRM 5.3 — Métricas y reportes del pipeline
- Módulo relacionado: 5.3 (pospuesto por decisión del usuario)
- Descripción: KPIs del CRM — total pipeline activo ($), tasa de conversión (ganadas/total cerradas), valor promedio por oportunidad, gráfico de embudo (funnel) por etapa.
- Prioridad sugerida: baja (cubrir primero Fase 6 Reportes general)
- Origen: decisión de alcance — integrar cuando Fase 6 esté lista para reutilizar componentes de gráficos

---

## ✅ [2026-05-01] PDF de DTE conforme al SII — IMPLEMENTADO 06/05/2026
- Módulo relacionado: 2.2, 2.3, 2.4, 2.5 (todos los tipos de DTE emitidos)
- Descripción: Al emitir un DTE correctamente en el SII, el sistema debe generar y almacenar el PDF oficial en el formato exigido por el SII (Representación Impresa del DTE). Actualmente SimpleAPI devuelve una URL de PDF en la respuesta (`pdfUrl`), pero no se descarga ni se almacena en ningún lado. El flujo completo debe:
  1. Recibir `pdfUrl` (y `xmlUrl`) desde SimpleAPI tras la emisión exitosa
  2. Descargar el PDF desde esa URL
  3. Subirlo a Cloudflare R2 con path `dte/{rut_empresa}/{año}/{mes}/{tipo}_{folio}.pdf`
  4. Guardar la URL R2 permanente en el campo `pdf_url` de la tabla correspondiente (`facturas`, `boletas`, `guias`)
  5. Hacer lo mismo con el XML (`xml_url`) para cumplir la retención legal de 6 años
  6. Exponer un botón "Ver PDF" / "Descargar PDF" en el listado de documentos emitidos
- Prioridad sugerida: alta — es un requisito legal para cualquier empresa que use el sistema en producción
- Origen: lo mencionó el usuario — es requisito SII para uso real del sistema
- Notas de implementación:
  - R2 ya está en el stack (variables de entorno definidas en CLAUDE.md) pero no se ha configurado el cliente aún
  - Instalar `@aws-sdk/client-s3` (compatible con R2) o usar la API REST de R2 directamente con `fetch`
  - El campo `pdf_url` ya existe en las tablas `facturas`, `boletas` y `guias` — solo falta llenarlo
  - Considerar también mostrar el PDF embebido en un modal o en una nueva pestaña desde el listado
  - El XML es obligatorio por ley (6 años de retención); el PDF es la representación visual para el receptor
  - SimpleAPI puede devolver el PDF ya generado con el timbre electrónico del SII incluido — verificar esto al retomar la integración real

---

## [2026-04-30] Asientos automáticos desde eventos de negocio
- Módulo relacionado: 7.3 (próximo en Fase 7 Contabilidad)
- Descripción: Cada evento del sistema (factura emitida, compra recibida, pago registrado) debe generar asientos contables automáticos en partida doble. Requiere configurar reglas contables por tipo de evento.
- Prioridad sugerida: alta — completa el módulo contable
- Origen: surgió al diseñar Fase 7
- Notas de implementación:
  - Tabla `asientos` (cabecera): id, fecha, descripcion, referencia_tipo, referencia_id
  - Tabla `asiento_lineas`: id, asiento_id, cuenta_id, debe, haber
  - Tabla `reglas_contables`: evento, cuenta_debe_id, cuenta_haber_id
  - Eventos: factura_emitida → CxC/Ventas/IVA Débito; compra_recibida → Existencias/CxP/IVA Crédito
  - Los módulos de facturación y compras disparan los asientos al cambiar estado
