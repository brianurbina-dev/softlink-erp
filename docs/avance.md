# Registro de avance — ERP Chile

Actualizar este archivo al cerrar cada módulo.
Claude Code lo lee para saber qué está hecho y qué viene.

---

## Estado general

| Fase | Módulos | Estado |
|------|---------|--------|
| Fase 1 — Core | 1.1 ✅, 1.2 ✅, 1.3 ✅ | ✅ Completa |
| Fase 2 — DTE | 2.1 ✅, 2.2 ✅, 2.3 ✅, 2.4 ✅, 2.5 ✅ | ✅ Completa |
| Fase 3 — Inventario | 3.1 ✅, 3.2 ✅, 3.3 ✅ | ✅ Completa |
| Fase 4 — Compras | 4.1 ✅, 4.2 ✅ | ✅ Completa |
| Fase 5 — CRM | 5.1 ✅, 5.2 ⏸, 5.3 ⏸ | ✅ 5.1 cerrado (5.2 y 5.3 → mejoras-pendientes) |
| Fase 6 — Reportes | 6.1 ✅, 6.2 ✅, 6.3 ✅ | ✅ Completa |
| Fase 7 — Contabilidad | 7.1 ✅, 7.2 ✅, 7.3 ✅, 7.4 ✅ | ✅ Completa |

---

## Módulos cerrados

## Módulo 1.2 — Autenticación y sesión
- Estado: ✅ CERRADO
- Fecha cierre: 30/04/2026
- Notas:
  - Login / logout con Supabase Auth (`@supabase/ssr`)
  - Registro de empresas crea schema PostgreSQL con 11 tablas operacionales via `pg` directo
  - Middleware de sesión protege `/dashboard` e inyecta empresa activa en cookie `sl_empresa_id`
  - Protección por rol: super_admin ve panel `/dashboard/admin`
  - Sidebar + Topbar con selector multiempresa y toggle dark/light (`next-themes`)
  - Prisma 7 requiere `@prisma/adapter-pg` — no acepta DATABASE_URL directamente
  - Zod 4.x usa `.issues` en lugar de `.errors`
  - Build de producción limpio, flujo completo probado por el usuario
- Próximo módulo: 1.3

## Módulo 1.1 — Infraestructura y setup
- Estado: ✅ CERRADO
- Fecha cierre: 30/04/2026
- Notas:
  - Next.js 14.2.35 + TypeScript + App Router + Tailwind CSS + shadcn/ui
  - Prisma 7.8.0 conectado a Supabase (schema público migrado: empresas, usuarios, empresa_usuario, dte_config)
  - ESLint + Prettier + estructura src/ completa según CLAUDE.md
  - Repositorio en GitHub: https://github.com/brianurbina-dev/softlink-erp
  - Deploy Vercel: pendiente (se conecta cuando haya una versión estable)
  - Decisión técnica: Prisma 7 no admite `url` en schema.prisma — se configura en prisma.config.ts
- Próximo módulo: 1.2

---

## Módulos cerrados

## Módulo 1.3 — Maestros base
- Estado: ✅ CERRADO
- Fecha cierre: 30/04/2026
- Notas:
  - CRUD completo de Clientes, Proveedores y Productos con validación RUT en tiempo real
  - Importación CSV de clientes y proveedores (upsert por RUT)
  - Búsqueda con debounce en todas las tablas
  - API routes multi-tenant usando `getEmpresaContext()` + `$queryRawUnsafe`
  - Componente `RutInput` con validación mod-11 y auto-formateo al blur
  - Sidebar colapsable: secciones con ChevronDown, sidebar slide-out con persistencia en localStorage
  - Bug fix: archivos de página deben estar bajo `(dashboard)/dashboard/...` para que la URL incluya `/dashboard/`
- Próximo módulo: 2.1

## Módulo 2.1 — Configuración DTE
- Estado: ✅ CERRADO
- Fecha cierre: 30/04/2026
- Notas:
  - Página `/dashboard/configuracion` con toggle de ambiente (certificacion/produccion)
  - Sección API Key: muestra valor enmascarado, campo show/hide, botón "Probar conexión" con estado inline
  - Sección Certificado Digital: upload .p12 → base64, campo contraseña show/hide
  - Botón Guardar activo solo cuando hay cambios pendientes
  - API: `GET/PUT /api/dte/config`, `POST /api/dte/config/test`
  - `SimpleAPIAdapter.testConexion()`: llama `GET /v1/dte/estado/TEST-0`, 401 = key inválido
  - Migración: columnas `certificado_nombre` y `certificado_password` en `dte_config`
  - Pendiente: aplicar migración SQL en Supabase antes de usar
- Próximo módulo: 2.2

## Módulo 2.2 — Emisión de facturas (tipo 33 y 34)
- Estado: ✅ CERRADO
- Fecha cierre: 30/04/2026
- Notas:
  - Página `/dashboard/facturacion/facturas` — listado con stats, filtros por estado, búsqueda, acciones inline (Emitir, Eliminar, PDF)
  - Página `/dashboard/facturacion/facturas/nueva` — formulario completo: tipo 33/34, selector de cliente, fecha, tabla de ítems dinámica, cálculo en tiempo real (neto/IVA/total)
  - Flujo dual: "Guardar borrador" (crea en BD) o "Emitir DTE" (crea + emite en secuencia)
  - API: `GET/POST /api/facturas`, `GET/PUT/DELETE /api/facturas/[id]`, `POST /api/facturas/[id]/emitir`
  - `SimpleAPIAdapter.emitirFactura()` implementado: envía a `POST /v1/dte/emitir` (endpoint a confirmar con ChileSystems)
  - Todas las queries operacionales usan `$queryRawUnsafe` con el schema de empresa
  - Nota: Email de factura y subida a R2 pendientes (requieren servicios no configurados aún)
- Próximo módulo: 2.3

## Módulo 2.3 — Boletas electrónicas (tipo 39)
- Estado: ✅ CERRADO
- Fecha cierre: 30/04/2026
- Notas:
  - Tablas `boletas` y `boleta_items` en schema de empresa (sin FK obligatoria a clientes)
  - Migración SQL con DO block para iterar sobre todos los schemas de empresa existentes
  - Página `/dashboard/facturacion/boletas` — listado con stats y acciones inline
  - Página `/dashboard/facturacion/boletas/nueva` — interfaz POS: grid de productos clickeables (filtrables), carrito lateral con +/- cantidad, receptor opcional, totales en tiempo real
  - Precio mostrado en catálogo = precio neto × 1.19 (precio al público con IVA)
  - `SimpleAPIAdapter.emitirBoleta()` implementado (tipo 39, receptor opcional)
  - DTEService.DatosBoleta actualizado con campos receptor opcionales
  - Pendiente: aplicar migración SQL `20260430070000_add_boletas_tables` en Supabase
- Próximo módulo: 2.4

## Módulo 2.4 — Notas de crédito y débito (61 y 56)
- Estado: ✅ CERRADO
- Fecha cierre: 30/04/2026
- Notas:
  - Migración SQL: agrega `referencia_tipo`, `referencia_folio`, `referencia_razon` a `facturas` en todos los schemas
  - DTEService: nuevo `DatosNota` interface + método `emitirNota()` implementado en SimpleAPIAdapter
  - `POST /api/facturas/[id]/anular` → crea + emite NC tipo 61 automáticamente, marca factura como 'anulada'
  - `GET/POST /api/notas` → lista/crea notas (filtrado sobre tabla facturas con tipo IN 56, 61)
  - `POST /api/notas/[id]/emitir` → emite nota en borrador
  - Facturas page: botón "Anular" para facturas emitidas con folio (con confirmación dialog)
  - `/dashboard/facturacion/notas` → listado + modal de creación manual (NC o ND) con prefill de ítems desde la factura de referencia
  - Notas parciales: el usuario puede ajustar cantidades antes de emitir
  - Pendiente: aplicar migración `20260430080000_add_facturas_referencia` en Supabase
- Próximo módulo: 2.5

## Módulo 2.5 — Guías de despacho (tipo 52)
- Estado: ✅ CERRADO
- Fecha cierre: 30/04/2026
- Notas:
  - Tablas `guias` y `guia_items` en schema de empresa (cliente opcional, transporte opcional)
  - Migración SQL con DO block para iterar sobre schemas existentes
  - DTEService: nuevo `DatosGuia` interface + `emitirGuia()` implementado en SimpleAPIAdapter (tipo=52, indicadorTipoDespacho, bloque transporte opcional)
  - API: `GET/POST /api/guias`, `GET/DELETE /api/guias/[id]`, `POST /api/guias/[id]/emitir`, `POST /api/guias/[id]/facturar`
  - `POST /api/guias/[id]/facturar`: crea factura borrador (tipo 33 si guía tipo 1, tipo 34 si traslado/consignación) con referencia_tipo=52 y copia de ítems
  - Página `/dashboard/facturacion/guias` — listado con stats (total/borradores/emitidas/facturadas), badges de tipo traslado y estado
  - Página `/dashboard/facturacion/guias/nueva` — formulario: selector de tipo de traslado (3 cards), receptor opcional, fecha, dirección destino, sección de transportista (RUT/nombre/patente), tabla de ítems, totales (IVA solo en tipo 1)
  - IVA solo aplica a tipo_traslado=1 (venta), tipos 2 y 3 tienen iva=0
  - Pendiente: aplicar migración `20260430090000_add_guias_tables` en Supabase
- Fase 2 completa — próximo paso: conectar con SimpleAPI (API key lista en /dashboard/configuracion) y luego Fase 3

## Módulo 3.1 — Bodegas
- Estado: ✅ CERRADO
- Fecha cierre: 30/04/2026
- Notas:
  - API: `GET/POST /api/bodegas`, `PUT/PATCH/DELETE /api/bodegas/[id]`
  - PATCH para toggle activa/inactiva (sin modal, inline en tabla)
  - DELETE protegido: bloquea si bodega tiene stock registrado en `inventario`
  - Página `/dashboard/inventario/bodegas` — CRUD inline con modal, KPI cards (total/activas/inactivas), toggle estado desde la tabla
  - Sidebar actualizado: Bodegas y Movimientos como items propios bajo Operaciones; Guías y Notas agregadas bajo Facturación
  - Tablas ya existían en `crearSchemaEmpresa()` — sin migraciones adicionales necesarias

## Módulo 3.2 — Stock actual
- Estado: ✅ CERRADO
- Fecha cierre: 30/04/2026
- Notas:
  - API: `GET /api/inventario` con filtros `?search=`, `?bodega=`, `?bajo=1`
  - JOIN triple: inventario ⟶ productos ⟶ bodegas
  - Costo promedio ponderado actualizado en cada movimiento de entrada
  - Página `/dashboard/inventario` — tabla con alertas de stock bajo mínimo, KPIs (productos/stock bajo/valor total), filtros combinados, links a Bodegas y Movimientos
  - KPI "Stock bajo" es clickeable para filtrar la vista

## Módulo 3.3 — Movimientos de inventario
- Estado: ✅ CERRADO
- Fecha cierre: 30/04/2026
- Notas:
  - API: `GET/POST /api/inventario/movimientos` con filtros `?tipo=`, `?bodega=`, `?producto=`
  - POST hace upsert de `inventario` + inserta `movimientos_inv` en secuencia (no transacción atómica — mejorable)
  - Salidas verifican stock disponible antes de procesar (409 si insuficiente)
  - Costo promedio actualizado solo en entradas con costo > 0
  - Página `/dashboard/inventario/movimientos` — listado filtrable, modal de nuevo movimiento con 3 tipos (Entrada/Salida/Ajuste), selector de producto y bodega, campo costo deshabilitado para salidas/ajustes
  - Ajustes no actualizan costo promedio (solo modifican stock_actual)
  - Próximo módulo sugerido: 4.1 (Compras) o revisar mejoras-pendientes

## Módulo 4.1 — Órdenes de compra
- Estado: ✅ CERRADO
- Fecha cierre: 01/05/2026
- Notas:
  - Validación Zod en `src/lib/validations/compras.ts` con `compraSchema` y `recibirCompraSchema`
  - API: `GET/POST /api/compras`, `GET/PUT/PATCH/DELETE /api/compras/[id]`, `POST /api/compras/[id]/recibir`
  - PATCH para cambio de estado borrador↔ordenada
  - Items sin campo `descuento` (a diferencia de facturas) — subtotal = cantidad × precio_unitario
  - Cuando se selecciona un producto, prefill usa `costo` (no `precio`) del catálogo
  - Estados: borrador → ordenada → recibida (recibida es terminal, no editable)
  - Página `/dashboard/compras` — listado con stats, botón Ordenar (borrador), botón Recibir (ordenada)
  - Página `/dashboard/compras/nueva` — formulario con proveedor, fecha, notas, tabla de ítems; botones "Guardar borrador" y "Marcar como ordenada"
  - Página `/dashboard/compras/[id]/editar` — edición de compras no recibidas, botón "Guardar y ordenar"

## Módulo 4.2 — Recepción e ingreso a inventario
- Estado: ✅ CERRADO
- Fecha cierre: 01/05/2026
- Notas:
  - `POST /api/compras/[id]/recibir` con `{ bodegaId }` en body
  - Verifica que la bodega exista y esté activa antes de procesar
  - Solo procesa ítems con `producto_id` no nulo (ítems de texto libre se ignoran)
  - Upsert de `inventario` con costo promedio ponderado por cada ítem
  - Inserta `movimientos_inv` con `referencia_tipo='compra'` y `referencia_id=compra.id`
  - Modal de recepción en listado de compras: selector de bodega de destino
  - Muestra cuántos productos fueron ingresados al inventario en el toast de confirmación

## Módulo 5.1 — Pipeline CRM
- Estado: ✅ CERRADO
- Fecha cierre: 01/05/2026
- Notas:
  - Tabla `oportunidades` ya existía en el schema de empresa (sin migraciones adicionales)
  - Validación Zod en `src/lib/validations/crm.ts` — etapas: prospecto, propuesta, negociacion, ganado, perdido
  - API: `GET/POST /api/crm/oportunidades`, `PUT/PATCH/DELETE /api/crm/oportunidades/[id]`
  - PATCH para cambio de etapa desde el kanban (sin recargar toda la lista — optimistic update)
  - Página `/dashboard/crm` — kanban con 5 columnas scrollable horizontalmente
  - Cada card muestra: título, cliente, valor estimado, fecha de cierre (rojo si vencida)
  - Botones ← → por card para mover entre etapas sin abrir modal
  - KPIs: oportunidades activas, valor total pipeline, cantidad ganadas, valor ganado
  - Modal crear/editar: título, cliente (opcional), etapa, valor estimado, fecha cierre, descripción
  - 5.2 (actividades) y 5.3 (métricas CRM) pospuestos a mejoras-pendientes.md
- Próximo módulo: Fase 6 Reportes

## Módulo 6.1 — Reporte de ventas
- Estado: ✅ CERRADO
- Fecha cierre: 01/05/2026
- Notas:
  - API `GET /api/reportes/ventas?desde=&hasta=` — agrega facturas + boletas emitidas
  - bigint de PostgreSQL convertido a Number() antes de devolver JSON (Prisma serializa bigint como string en algunos entornos)
  - Combina facturas y boletas con merge por clave "YYYY-MM", genera los 6 meses aunque no haya datos
  - KPIs: total período, cantidad docs, ticket promedio, ventas mes actual vs mes anterior (delta %)
  - Página con filtro de rango de fechas, gráfico de barras CSS (sin librería), top 10 clientes y productos
  - Componente `BarChart` reutilizable en `src/components/erp/BarChart.tsx` — CSS puro, tooltip on hover

## Módulo 6.2 — Reporte de inventario
- Estado: ✅ CERRADO
- Fecha cierre: 01/05/2026
- Notas:
  - API `GET /api/reportes/inventario` — sin parámetros, siempre estado actual
  - Valor por bodega con porcentaje sobre total, movimientos del mes actual por tipo
  - Top 10 productos por valor en stock (solo con costo_promedio > 0)
  - Página sin filtro de fecha (snapshot actual)

## Módulo 6.3 — Reporte de compras
- Estado: ✅ CERRADO
- Fecha cierre: 01/05/2026
- Notas:
  - API `GET /api/reportes/compras?desde=&hasta=` — solo compras con estado='recibida'
  - Margen bruto estimado = ventas (facturas emitidas) - compras (recibidas) del mismo período
  - Porcentaje de margen s/ ventas calculado en frontend
  - Top proveedores con barra de proporción relativa al mayor
  - Dashboard actualizado: KPIs reales (ventas mes, docs emitidos, stock bajo, pipeline CRM)
  - Dashboard: sección de links rápidos a reportes y accesos directos a acciones frecuentes
  - Sidebar: nueva sección "Reportes" con Ventas, Inventario y Compras

## Módulo 7.1 — Plan de Cuentas
- Estado: ✅ CERRADO
- Fecha cierre: 02/05/2026
- Notas:
  - Tabla `plan_cuentas` agregada al schema de empresa (código único, árbol con `cuenta_padre_id`, flag `acepta_movimientos`)
  - Migración SQL `20260502000000_add_plan_cuentas` para schemas existentes (aplicar en Supabase)
  - Plan de cuentas estándar Chile según clasificación SII: 5 categorías (Activo, Pasivo, Patrimonio, Ingresos, Gastos), ~50 cuentas predefinidas
  - API: `GET/POST /api/contabilidad/plan-cuentas`, `PUT/PATCH/DELETE /api/contabilidad/plan-cuentas/[id]`, `POST /api/contabilidad/plan-cuentas/inicializar`
  - Página `/dashboard/contabilidad/plan-cuentas` — árbol expandible 3 niveles, badges por tipo, acciones hover (agregar hijo, editar, toggle activo, eliminar)
  - El botón "Cargar plan estándar Chile" aparece solo cuando no hay cuentas — usa ON CONFLICT DO NOTHING para re-ejecuciones seguras
  - Sidebar: nueva sección "Contabilidad" con Plan de Cuentas
## Módulo 7.2 — Asientos Contables Manuales
- Estado: ✅ CERRADO
- Fecha cierre: 02/05/2026
- Notas:
  - Tablas `asientos` y `asiento_lineas` en schema de empresa (partida doble)
  - API: `GET/POST /api/contabilidad/asientos`, `GET/DELETE /api/contabilidad/asientos/[id]`
  - Validación partida doble: sum(debe) == sum(haber) antes de guardar; asiento de $0 rechazado
  - No se puede eliminar asientos automáticos (protección)
  - Página `/dashboard/contabilidad/asientos` — listado con filtro de fechas, fila expandible con detalle de líneas, modal de nuevo asiento con tabla dinámica de líneas y validación en tiempo real

## Módulo 7.3 — Asientos Automáticos
- Estado: ✅ CERRADO
- Fecha cierre: 02/05/2026
- Notas:
  - Tabla `reglas_contables` — une evento + cuenta + tipo (debe/haber) + campo_monto (neto/iva/total)
  - Servicio `src/services/contabilidad/asientosService.ts` — busca reglas activas, filtra líneas $0, valida que cuadre, inserta asiento silenciosamente si falla
  - 4 eventos: `factura_emitida`, `boleta_emitida`, `compra_recibida`, `nota_credito_emitida`
  - Hook en `POST /api/facturas/[id]/emitir` y `POST /api/compras/[id]/recibir`
  - API: `GET/POST /api/contabilidad/reglas`, `DELETE/PATCH /api/contabilidad/reglas/[id]`, `POST /api/contabilidad/reglas/inicializar`
  - "Cargar reglas estándar Chile" inserta 12 reglas (requiere plan de cuentas cargado)
  - Página `/dashboard/contabilidad/reglas` — secciones por evento, toggle activo/inactivo, agregar/eliminar reglas

## Módulo 7.4 — Reportes Contables
- Estado: ✅ CERRADO
- Fecha cierre: 02/05/2026
- Notas:
  - API: `GET /api/contabilidad/reportes/balance`, `GET /api/contabilidad/reportes/resultados`, `GET /api/contabilidad/reportes/mayor`
  - Balance General: saldo por cuenta según convención (activo/gasto = debe-haber; pasivo/patrimonio/ingreso = haber-debe), ecuación contable al pie
  - Estado de Resultados: ingresos, gastos, resultado neto del período; con colores semánticos
  - Libro Mayor: movimientos de una cuenta con saldo acumulado corriente
  - Página `/dashboard/contabilidad/reportes` — 3 tabs, filtro de rango de fechas compartido
  - Migración consolidada `20260502100000_add_contabilidad_completa` cubre las 4 tablas de Fase 7

---

## Notas y decisiones tomadas en el camino

### 30/04/2026 — Prisma 7 (breaking change)
Prisma 7.8.0 no permite `url` ni `directUrl` en `schema.prisma`.
Se configura en `prisma.config.ts`. El cliente lee `DATABASE_URL` del entorno automáticamente.
Para migraciones Supabase usar `DIRECT_URL` apuntando a `db.[ref].supabase.co:5432` con usuario `postgres`.

### 30/04/2026 — Prisma 7 requiere adapter de base de datos
En Prisma 7, el engine por defecto ("client"/Wasm) no acepta DATABASE_URL directamente.
Se resuelve instalando `@prisma/adapter-pg` y pasando un `Pool` de `pg` al constructor.
La instancia de `pg.Pool` con `DIRECT_URL` se sigue usando para operaciones DDL (crear schemas de empresa).

### 30/04/2026 — Zod v4 renombró .errors a .issues
Zod 4.x cambió `error.errors[0]` por `error.issues[0]`. Afecta todos los `safeParse()`.

### 30/04/2026 — Deploy Vercel diferido
Se decidió no deployar en Vercel durante el Módulo 1.1.
El deploy se hará cuando haya una versión estable con autenticación funcionando.
Vercel se conecta a GitHub en 5 minutos cuando sea necesario.
