# PRD — ERP Chile
**Product Requirements Document**
Versión 1.0 | Metodología: Ágil modular | Desarrollador: Solo + Claude Code

---

## 1. Visión general

### Descripción
ERP web SaaS multi-tenant adaptado a la normativa chilena. Permite a cualquier empresa gestionar facturación electrónica (DTE), inventario, compras y CRM desde una plataforma centralizada, con integración nativa al SII.

### Propuesta de valor
- Alternativa accesible a ERPs establecidos (Defontana, Bsale, SAP)
- 100% adaptado a normativa tributaria chilena desde el diseño
- Modelo SaaS por suscripción mensual, sin instalación
- Multiempresa: un usuario puede gestionar múltiples RUTs

### Modelo de negocio
SaaS con planes mensuales por volumen de documentos DTE:

| Plan | Precio | DTE/mes | Usuarios |
|------|--------|---------|----------|
| Starter | $25.000 CLP | hasta 100 | 2 |
| PyME | $55.000 CLP | hasta 500 | 5 |
| Pro | $120.000 CLP | hasta 2.000 | ilimitados |

---

## 2. Usuarios del sistema

### Super Admin (tú)
- Acceso a todas las empresas registradas
- Panel de administración global
- Gestión de planes y suscripciones
- Monitoreo de uso y errores DTE

### Admin de empresa
- Acceso completo a su empresa
- Puede invitar y gestionar usuarios de su organización
- Configura parámetros de la empresa (certificado digital, datos SII)

### Roles futuros (versiones posteriores)
Contador, Vendedor, Bodeguero — con acceso restringido por módulo.

---

## 3. Stack tecnológico

| Capa | Tecnología | Justificación |
|------|-----------|--------------|
| Framework | Next.js 14+ App Router | Full-stack, SSR, un solo repo |
| Lenguaje | TypeScript | Tipado estricto, menos bugs |
| UI | Tailwind CSS + shadcn/ui | Componentes accesibles, rápido de usar |
| ORM | Prisma | Migraciones claras, soporte multi-schema |
| Base de datos | PostgreSQL (Supabase) | ACID, robusto para contabilidad |
| Auth | Supabase Auth | Multiempresa con roles |
| DTE | SimpleAPI (ChileSystems) | Experiencia previa, plan gratuito 1 año |
| Archivos | Cloudflare R2 | XMLs y PDFs de DTE |
| Deploy | Vercel | CI/CD automático desde GitHub |

### Arquitectura multi-tenant
Schema separado por empresa en PostgreSQL.
Cada empresa registrada genera un schema propio (`empresa_{id}`).
El schema `public` contiene solo datos globales del sistema.

---

## 4. Requerimientos no funcionales Chile

### Obligatorios desde el día 1
- Validación de RUT (módulo 11) en todos los formularios
- IVA 19% como constante del sistema
- Soporte para UF, UTM y CLP
- Almacenamiento de XMLs DTE por 6 años mínimo (ley)
- Zona horaria: `America/Santiago`
- Formato de fechas: `DD/MM/YYYY` en UI, ISO 8601 en BD

### Documentos DTE soportados
Factura afecta (33), Factura exenta (34), Boleta (39),
Nota de crédito (61), Nota de débito (56), Guía de despacho (52).

---

## 5. Planificación modular

La metodología es **ágil modular**: cada módulo se planifica, desarrolla, prueba y cierra antes de pasar al siguiente. Al cerrar un módulo se actualiza `docs/avance.md`.

---

### FASE 1 — Core del sistema
**Objetivo:** La base sobre la que todo lo demás se construye.
**Duración estimada:** 4-6 semanas

#### Módulo 1.1 — Infraestructura y setup
- [ ] Repositorio GitHub con estructura de carpetas definida
- [ ] Next.js 14 con TypeScript configurado
- [ ] Prisma + Supabase conectados
- [ ] Variables de entorno documentadas en `.env.example`
- [ ] ESLint + Prettier configurados
- [ ] Deploy inicial en Vercel funcionando

**Criterio de cierre:** App vacía deployada, BD conectada, CI/CD verde.

#### Módulo 1.2 — Autenticación y sesión
- [ ] Login / logout con Supabase Auth
- [ ] Registro de nuevas empresas (crea schema PostgreSQL automáticamente)
- [ ] Middleware de sesión que inyecta empresa activa en cada request
- [ ] Protección de rutas por rol
- [ ] Selector de empresa (si el usuario pertenece a varias)
- [ ] Panel Super Admin (lista de empresas, estado, plan)

**Criterio de cierre:** Un usuario puede registrar una empresa, iniciar sesión y ver su dashboard vacío.

#### Módulo 1.3 — Maestros base
- [ ] CRUD de Clientes (RUT, razón social, giro, contacto, dirección)
- [ ] CRUD de Proveedores (mismos campos)
- [ ] CRUD de Productos (código, nombre, precio, costo, unidad, IVA)
- [ ] Validación de RUT en tiempo real en todos los formularios
- [ ] Búsqueda y filtros en todas las tablas
- [ ] Importación de clientes/proveedores desde Excel (CSV)

**Criterio de cierre:** Se pueden crear, editar, buscar y eliminar clientes, proveedores y productos.

---

### FASE 2 — Facturación electrónica DTE
**Objetivo:** El módulo más crítico. Integración con SII vía SimpleAPI.
**Duración estimada:** 5-7 semanas

#### Módulo 2.1 — Configuración DTE por empresa
- [ ] Carga del certificado digital (.p12) por empresa
- [ ] Configuración de credenciales SimpleAPI por empresa
- [ ] Toggle ambiente pruebas / producción
- [ ] Validación de conexión con SII al guardar configuración
- [ ] Capa de abstracción `DTEService` implementada con `SimpleAPIAdapter`

**Criterio de cierre:** Una empresa puede conectar su certificado y verificar comunicación con el SII.

#### Módulo 2.2 — Emisión de facturas (tipo 33 y 34)
- [ ] Formulario de nueva factura (cliente, fecha, items, descuentos)
- [ ] Cálculo automático de subtotal, IVA y total
- [ ] Emisión a SII vía SimpleAPI
- [ ] Almacenamiento de XML y PDF en R2
- [ ] Descarga de PDF desde la plataforma
- [ ] Envío de PDF por email al cliente
- [ ] Listado de facturas con estados (borrador, emitida, anulada)

**Criterio de cierre:** Se puede emitir una factura real al SII, descargar el PDF y enviarlo por email.

#### Módulo 2.3 — Boletas electrónicas (tipo 39)
- [ ] Formulario simplificado de boleta (sin datos de receptor obligatorios)
- [ ] Emisión masiva desde listado de productos (punto de venta básico)
- [ ] Almacenamiento y descarga igual que facturas

**Criterio de cierre:** Se puede emitir una boleta electrónica válida ante el SII.

#### Módulo 2.4 — Notas de crédito y débito (61 y 56)
- [ ] Emisión de nota de crédito referenciando una factura existente
- [ ] Emisión de nota de débito
- [ ] Anulación de facturas (genera nota de crédito automáticamente)
- [ ] Actualización de estados en el listado de facturas

**Criterio de cierre:** Se puede anular una factura emitida correctamente.

#### Módulo 2.5 — Guías de despacho (tipo 52)
- [ ] Formulario de guía de despacho (emisor, receptor, productos, transportista)
- [ ] Tipos: venta, traslado interno, consignación
- [ ] Facturación posterior desde guías pendientes

**Criterio de cierre:** Se puede emitir una guía de despacho y facturarla posteriormente.

---

### FASE 3 — Inventario y bodega
**Objetivo:** Control de stock en tiempo real.
**Duración estimada:** 3-4 semanas

#### Módulo 3.1 — Bodegas y stock inicial
- [ ] CRUD de bodegas
- [ ] Ingreso de stock inicial por producto/bodega
- [ ] Vista de stock actual (producto, bodega, cantidad, costo promedio)

**Criterio de cierre:** Se puede ver el stock actual de cada producto por bodega.

#### Módulo 3.2 — Movimientos de inventario
- [ ] Entrada de mercadería (con o sin orden de compra)
- [ ] Salida de mercadería manual
- [ ] Descuento automático de stock al emitir factura o guía de despacho
- [ ] Historial de movimientos con trazabilidad completa
- [ ] Alertas de stock mínimo

**Criterio de cierre:** El stock se actualiza automáticamente al facturar y se puede ver el historial.

#### Módulo 3.3 — Valorización de inventario
- [ ] Costo promedio ponderado
- [ ] Informe de valorización de stock
- [ ] Kardex por producto

**Criterio de cierre:** Se puede obtener el valor monetario del inventario actual.

---

### FASE 4 — Compras y proveedores
**Objetivo:** Gestión del ciclo de compra.
**Duración estimada:** 3-4 semanas

#### Módulo 4.1 — Órdenes de compra
- [ ] Creación de OC (proveedor, productos, cantidades, precios)
- [ ] Estados: borrador, enviada, recibida parcial, recibida completa
- [ ] Generación de PDF de OC para enviar al proveedor
- [ ] Envío por email al proveedor

**Criterio de cierre:** Se puede crear una OC, generar el PDF y enviarlo.

#### Módulo 4.2 — Recepción de compras
- [ ] Recepción total o parcial contra OC
- [ ] Ingreso automático al inventario al recepcionar
- [ ] Registro de factura del proveedor (número, fecha, monto)
- [ ] Libro de compras básico (registro de facturas recibidas)

**Criterio de cierre:** Al recepcionar una compra, el stock sube automáticamente.

---

### FASE 5 — CRM y ventas
**Objetivo:** Pipeline comercial básico.
**Duración estimada:** 3-4 semanas

#### Módulo 5.1 — Pipeline de oportunidades
- [ ] CRUD de oportunidades (cliente, descripción, valor estimado, etapa, fecha cierre)
- [ ] Etapas: Prospecto → Cotización → Negociación → Cerrado ganado / Cerrado perdido
- [ ] Vista kanban del pipeline
- [ ] Vista lista con filtros

**Criterio de cierre:** Se puede ver el pipeline de ventas en formato kanban.

#### Módulo 5.2 — Cotizaciones
- [ ] Creación de cotización (igual que factura pero sin emitir al SII)
- [ ] PDF de cotización con logo y datos de la empresa
- [ ] Envío por email
- [ ] Conversión de cotización a factura con un clic

**Criterio de cierre:** Se puede crear una cotización y convertirla en factura directamente.

#### Módulo 5.3 — Actividades y seguimiento
- [ ] Registro de actividades por oportunidad (llamada, reunión, email, tarea)
- [ ] Recordatorios y fechas de seguimiento
- [ ] Historial de interacciones por cliente

**Criterio de cierre:** Se puede registrar actividades y ver el historial de un cliente.

---

### FASE 6 — Reportes y dashboard
**Objetivo:** Visibilidad del negocio.
**Duración estimada:** 2-3 semanas

#### Módulo 6.1 — Dashboard principal
- [ ] KPIs: ventas del mes, facturas emitidas, stock bajo mínimo, oportunidades abiertas
- [ ] Gráfico de ventas últimos 12 meses
- [ ] Top 5 clientes y top 5 productos del mes
- [ ] Alertas activas (folios por vencer, stock crítico)

#### Módulo 6.2 — Reportes tributarios
- [ ] Libro de ventas (formato SII)
- [ ] Libro de compras (formato SII)
- [ ] Resumen mensual por tipo de documento
- [ ] Exportación a Excel

#### Módulo 6.3 — Reportes de inventario y ventas
- [ ] Informe de rentabilidad por producto
- [ ] Rotación de inventario
- [ ] Informe de deudores (facturas pendientes de pago)

---

## 6. Registro de avance

El archivo `docs/avance.md` se actualiza al cerrar cada módulo.

Formato:

```markdown
## Módulo X.X — Nombre
- Estado: CERRADO
- Fecha cierre: DD/MM/YYYY
- Notas: [decisiones tomadas, cambios respecto al PRD]
- Próximo módulo: X.X
```

---

## 7. Integraciones externas

| Servicio | Propósito | Estado |
|----------|-----------|--------|
| SimpleAPI (ChileSystems) | Emisión DTE al SII | Pendiente configurar |
| Supabase | BD + Auth | Pendiente crear proyecto |
| Cloudflare R2 | Almacenamiento archivos | Pendiente crear bucket |
| Vercel | Hosting y CI/CD | Pendiente crear proyecto |
| Resend o Nodemailer | Envío de emails | Pendiente definir |
| mindicador.cl | UF, UTM, indicadores | API pública gratuita |

---

## 8. Decisiones de arquitectura registradas

| Fecha | Decisión | Razón |
|-------|---------|-------|
| 2026-04 | PostgreSQL schemas separados por empresa | Aislamiento total de datos tributarios |
| 2026-04 | Next.js full-stack (no separado) | Un solo repo, más simple para desarrollo solo |
| 2026-04 | SimpleAPI como proveedor DTE inicial | Experiencia previa, plan gratuito 1 año en producción |
| 2026-04 | Capa de abstracción DTEService | Permite migrar de proveedor sin tocar módulos de negocio |
| 2026-04 | Montos en CLP como integer | Sin decimales en pesos chilenos, evita errores de redondeo |
| 2026-04 | Planes por volumen DTE | Modelo estándar del mercado chileno, percibido como justo |
