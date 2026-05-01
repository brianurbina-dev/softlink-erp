# Mejoras pendientes — Softlink ERP

Ideas y mejoras que surgieron durante el desarrollo pero que no están en el PRD actual.
Se revisan al cerrar cada fase para decidir si se incorporan al roadmap.

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

## [2026-05-01] PDF de DTE conforme al SII
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
