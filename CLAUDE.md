# ERP Chile — Contexto para Claude Code

Este archivo es leído automáticamente por Claude Code en cada sesión.
Contiene las decisiones de arquitectura, convenciones y reglas de negocio del proyecto.

---

## Stack tecnológico

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Frontend | Next.js 14+ (App Router) | SSR, rutas protegidas por empresa |
| Estilos | Tailwind CSS + shadcn/ui | Componentes base del sistema |
| Backend | Next.js API Routes + TypeScript | Full-stack monorepo |
| ORM | Prisma | Migraciones versionadas, tipado fuerte |
| Base de datos | PostgreSQL en Supabase | Multi-tenant por schemas |
| Auth | Supabase Auth | Roles por organización |
| Archivos | Cloudflare R2 | XMLs SII, PDFs de DTE |
| Deploy | Vercel | Frontend + API |
| DTE | SimpleAPI (ChileSystems) | Con capa de abstracción, ver abajo |

---

## Arquitectura multi-tenant

Cada empresa tiene su propio **PostgreSQL schema** (ej: `empresa_abc123`).
El schema público (`public`) contiene solo: `empresas`, `usuarios`, `empresa_usuario`, `dte_config`.

### Regla crítica
**Toda query a tablas de operación DEBE incluir el schema de la empresa activa.**
Nunca hacer queries sin contexto de empresa. El middleware de sesión inyecta el schema.

```typescript
// CORRECTO
const facturas = await prisma.$queryRaw`
  SELECT * FROM ${empresaSchema}.facturas WHERE estado = 'emitida'
`

// INCORRECTO — nunca sin schema
const facturas = await prisma.facturas.findMany()
```

---

## Modelo de datos — Schema público

```
empresas          → datos de cada empresa cliente (RUT, razón social, schema_name, plan)
usuarios          → usuarios del sistema (email, nombre, rol global)
empresa_usuario   → relación N:N (un usuario puede estar en múltiples empresas con distintos roles)
dte_config        → configuración DTE por empresa (proveedor, api_key, certificado, ambiente)
```

## Modelo de datos — Schema por empresa

```
clientes          → RUT, razón social, giro, contacto, dirección
proveedores       → RUT, razón social, giro, contacto, dirección
productos         → código, nombre, precio, costo, unidad, afecto_iva
facturas          → cabecera DTE (tipo, folio, fecha, cliente, totales, estado)
factura_items     → líneas de detalle de cada factura
inventario        → stock actual por producto y bodega
bodegas           → ubicaciones físicas de inventario
movimientos_inv   → trazabilidad de entradas/salidas de stock
oportunidades     → pipeline CRM (cliente, etapa, valor, fecha cierre estimada)
compras           → órdenes de compra a proveedores
compra_items      → líneas de detalle de cada compra
```

---

## Capa de abstracción DTE

**Nunca llamar directamente a SimpleAPI desde los módulos de negocio.**
Siempre usar el servicio abstracto `DTEService`.

```typescript
// src/services/dte/DTEService.ts
interface DTEService {
  emitirFactura(datos: DatosFactura): Promise<ResultadoDTE>
  emitirBoleta(datos: DatosBoleta): Promise<ResultadoDTE>
  anularDocumento(folio: number, tipo: number): Promise<boolean>
  consultarEstado(trackId: string): Promise<EstadoDTE>
  obtenerPDF(folio: number, tipo: number): Promise<Buffer>
}

// src/services/dte/adapters/SimpleAPIAdapter.ts  ← implementación actual
// src/services/dte/adapters/YAMTAdapter.ts        ← futura alternativa
```

El adaptador activo se configura en `dte_config` por empresa.
Para cambiar de proveedor: solo cambiar el adaptador, ningún módulo de negocio se modifica.

---

## Reglas de negocio Chile — SIEMPRE aplicar

### RUT
- Todo RUT debe validarse con el algoritmo módulo 11 antes de guardar
- Formato de almacenamiento: `12345678-9` (con guión, sin puntos)
- Formato de display: `12.345.678-9` (con puntos y guión)
- Usar la función `validarRut(rut: string): boolean` de `src/lib/chile/rut.ts`

### IVA
- IVA estándar Chile: **19%**
- Constante: `IVA_CHILE = 0.19` en `src/lib/chile/impuestos.ts`
- Nunca hardcodear 0.19 en componentes — siempre importar la constante
- Existen casos de IVA exento (facturas exentas tipo 34) — siempre verificar `afecto_iva` del producto

### Monedas y valores
- Moneda base: CLP (pesos chilenos, sin decimales)
- Redondeo: Math.round() — nunca Math.floor() ni Math.ceil() para montos
- UF y UTM: consultar en tiempo real desde `https://mindicador.cl/api`
- Almacenar montos siempre en CLP como integer

### Documentos DTE soportados
| Tipo | Código SII | Descripción |
|------|-----------|-------------|
| Factura afecta | 33 | Venta con IVA entre empresas |
| Factura exenta | 34 | Venta sin IVA |
| Boleta afecta | 39 | Venta a consumidor final |
| Nota de crédito | 61 | Anulación o descuento |
| Nota de débito | 56 | Cargo adicional |
| Guía de despacho | 52 | Traslado de mercadería |

### Almacenamiento de DTEs
- Todo XML de DTE debe guardarse en Cloudflare R2
- Path: `r2://dte/{rut_empresa}/{año}/{mes}/{tipo}_{folio}.xml`
- Retención mínima legal: **6 años**
- PDFs también deben guardarse junto al XML

---

## Roles del sistema

| Rol | Acceso |
|-----|--------|
| `super_admin` | Todas las empresas, panel de administración global |
| `admin` | Empresa propia completa |
| `contador` | Facturación y contabilidad (próxima versión) |
| `vendedor` | CRM y ventas (próxima versión) |
| `bodeguero` | Inventario (próxima versión) |

---

## Convenciones de código

### Estructura de carpetas
```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Rutas de autenticación
│   ├── (dashboard)/        # Rutas protegidas del ERP
│   │   ├── facturacion/
│   │   ├── inventario/
│   │   ├── crm/
│   │   └── compras/
│   └── api/                # API Routes
│       ├── dte/
│       ├── clientes/
│       ├── productos/
│       └── inventario/
├── components/
│   ├── ui/                 # shadcn/ui (no modificar)
│   └── erp/                # componentes propios del ERP
├── lib/
│   ├── chile/              # utilidades específicas Chile (rut, impuestos, etc.)
│   ├── db/                 # cliente Prisma y helpers de schema
│   └── validations/        # schemas Zod
├── services/
│   ├── dte/                # capa abstracción DTE
│   └── email/              # envío de documentos
└── types/                  # tipos TypeScript globales
```

### Nombrado
- Archivos: `kebab-case.ts`
- Componentes React: `PascalCase.tsx`
- Funciones y variables: `camelCase`
- Constantes globales: `UPPER_SNAKE_CASE`
- Tablas Prisma: `snake_case`

### API Routes
- Siempre validar con Zod antes de procesar
- Siempre verificar sesión y permisos antes de operar
- Respuestas: `{ data, error, meta }` consistente en toda la API

### Manejo de errores
- Usar `Result<T, E>` pattern en servicios (no lanzar excepciones)
- Loggear errores de DTE siempre (son críticos)
- En el cliente: toast para errores de usuario, console.error para errores técnicos

---

## Variables de entorno requeridas

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# SimpleAPI
SIMPLEAPI_BASE_URL=https://api.simpleapi.cl
SIMPLEAPI_APIKEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

# App
NEXT_PUBLIC_APP_URL=
```

---

## Hosting e infraestructura

| Servicio | Plataforma | Propósito |
|----------|-----------|-----------|
| App Next.js | Vercel | Deploy automático desde GitHub en cada push |
| Base de datos | Supabase (PostgreSQL) | BD gestionada, backups automáticos, Auth incluido |
| Archivos DTE | Cloudflare R2 | XMLs y PDFs de facturas, 10 GB gratuitos iniciales |

No hay servidores que administrar. Todo es gestionado con SSL incluido y alta disponibilidad.
El flujo de deploy es: `git push → GitHub → Vercel despliega automáticamente`.

---

## Sistema de diseño — Softlink ERP

### Identidad visual
- Nombre del producto: **Softlink ERP**
- Estilo: moderno, oscuro, corporativo — inspirado en herramientas SaaS premium
- Dos temas obligatorios: **dark mode** (por defecto) y **light mode**

### Paleta de colores

| Token | Valor | Uso |
|-------|-------|-----|
| `--sl-purple` | `#7F77DD` | Color primario, acento, botones principales, elementos activos |
| `--sl-purple-light` | `#AFA9EC` | Texto sobre fondos oscuros, hover states |
| `--sl-purple-dark` | `#534AB7` | Avatar, badges, variante oscura del primario |
| `--sl-bg-dark` | `#0f0f14` | Fondo principal en dark mode |
| `--sl-bg-card` | `#16161f` | Cards y paneles en dark mode |
| `--sl-bg-sidebar` | `#0b0b11` | Sidebar en dark mode |
| `--sl-border` | `#2a2a3a` | Bordes en dark mode |
| `--sl-text` | `#f0f0f5` | Texto principal en dark mode |
| `--sl-muted` | `#888899` | Texto secundario/muted en dark mode |
| `--sl-card-light` | `#ffffff` | Cards en light mode |
| `--sl-bg-light` | `#f4f4f8` | Fondo principal en light mode |
| `--sl-sidebar-light` | `#1a1a2e` | Sidebar en light mode (mantiene oscuro para identidad de marca) |
| `--sl-border-light` | `#e2e2ee` | Bordes en light mode |
| `--sl-text-light` | `#1a1a2e` | Texto principal en light mode |
| `--sl-muted-light` | `#6b6b88` | Texto muted en light mode |

**Colores semánticos (igual en ambos temas):**
- Verde `#1D9E75` → éxito, emitida, activo
- Ámbar `#BA7517` → advertencia, pendiente, stock bajo
- Rojo `#E24B4A` → error, anulada, vencida, crítico
- Violeta `#7F77DD` → información, acción primaria

### Tailwind — configuración en `tailwind.config.ts`

```typescript
colors: {
  sl: {
    purple: '#7F77DD',
    'purple-light': '#AFA9EC',
    'purple-dark': '#534AB7',
    'bg-dark': '#0f0f14',
    'bg-card': '#16161f',
    'bg-sidebar': '#0b0b11',
    border: '#2a2a3a',
  }
}
```

### Layout general

```
┌─────────────────────────────────────────────┐
│  Sidebar (220px fijo)  │  Topbar (56px alto) │
│                        ├─────────────────────│
│  Logo Softlink ERP     │                     │
│  ─────────────────     │   Área de contenido │
│  Menú de navegación    │   (cambia por ruta) │
│                        │                     │
│  ─────────────────     │                     │
│  Avatar + usuario      │                     │
└─────────────────────────────────────────────┘
```

**Sidebar izquierda (220px, fijo):**
- Fondo `--sl-bg-sidebar` en dark / `--sl-sidebar-light` en light (siempre oscuro para mantener marca)
- Logo "**Soft**link ERP" con "Soft" en blanco y "link ERP" en `--sl-purple`
- Secciones de navegación: Principal, Facturación, Operaciones, Configuración
- Item activo: `background: rgba(127,119,221,0.18)`, texto `--sl-purple-light`
- Hover: `background: rgba(127,119,221,0.12)`
- Footer del sidebar: avatar con iniciales + nombre + rol del usuario

**Topbar (56px, fijo arriba):**
- Badge de empresa activa con punto verde (indica activa) y flecha para cambiar empresa
- Botón de notificaciones con dot rojo cuando hay alertas
- Botón de búsqueda global
- Toggle light/dark mode

**Área de contenido:**
- Padding: `24px`
- Page header: título `18px/500` + subtítulo muted con empresa y fecha
- Cards: `border-radius: 10px`, border `1px solid --sl-border`, fondo `--sl-bg-card`

### Navegación — rutas del sidebar

| Sección | Item | Ruta |
|---------|------|------|
| Principal | Dashboard | `/dashboard` |
| Facturación | Facturas | `/dashboard/facturacion/facturas` |
| Facturación | Boletas | `/dashboard/facturacion/boletas` |
| Facturación | Cotizaciones | `/dashboard/facturacion/cotizaciones` |
| Operaciones | Inventario | `/dashboard/inventario` |
| Operaciones | Compras | `/dashboard/compras` |
| Operaciones | CRM | `/dashboard/crm` |
| Configuración | Configuración | `/dashboard/configuracion` |

### Página inicial — Dashboard `/dashboard`

La primera pantalla que ve el usuario al hacer login es el dashboard con:

**KPIs (grid de 4 columnas):**
1. Ventas del mes (monto CLP + delta % vs mes anterior)
2. Facturas emitidas (cantidad + delta vs mes anterior)
3. Por cobrar (monto CLP + cantidad de facturas vencidas)
4. Stock bajo mínimo (cantidad de productos bajo stock mínimo)

**Fila secundaria (2 columnas, ratio 1.5:1):**
- Gráfico de barras: ventas últimos 6 meses (barra del mes actual en `--sl-purple`, resto en `rgba(127,119,221,0.25)`)
- Feed de actividad reciente: últimas acciones con dot de color semántico + texto + tiempo relativo

**Tabla inferior:**
- Últimas 5 facturas emitidas: folio, cliente, fecha, monto, estado (badge de color)
- Estados con badges: Emitida (verde), Pendiente (ámbar), Vencida/Anulada (rojo)

### Componentes reutilizables

**KPI Card** (`src/components/erp/KpiCard.tsx`):
- Label muted 12px arriba
- Valor principal 22px/500
- Delta con color semántico (▲ verde / ▼ rojo) + texto descriptivo
- Ícono SVG flotante a la derecha, color `--sl-purple`, opacidad 50%

**Badge de estado** (`src/components/erp/StatusBadge.tsx`):
- `emitida` → fondo `rgba(29,158,117,0.15)`, texto `#1D9E75`
- `pendiente` → fondo `rgba(186,117,23,0.15)`, texto `#BA7517`
- `anulada` / `vencida` → fondo `rgba(226,75,74,0.15)`, texto `#E24B4A`

**Botón primario:**
- Fondo `--sl-purple`, texto blanco, `border-radius: 8px`, hover `--sl-purple-dark`

**Input / Select:**
- Border `1px solid --sl-border`, fondo `--sl-bg-card` en dark
- Focus: border `--sl-purple`, sin shadow externo

---

## Estado del proyecto

Ver `docs/avance.md` para el registro de módulos completados, en progreso y pendientes.
Actualizar ese archivo al cerrar cada módulo.

---

## Reglas de flujo de trabajo con el usuario

### Git — regla crítica
**Nunca hacer `git commit` ni `git push` sin que el usuario lo solicite explícitamente.**
Solo ejecutar comandos git de lectura (status, log, diff) de forma autónoma.
Para commits y pushes, esperar instrucción directa del usuario.

---

## Registro de ideas y mejoras pendientes

Durante el desarrollo van a surgir ideas, mejoras o funcionalidades que no están en el PRD actual pero que vale la pena considerar después. **Nunca implementarlas de inmediato** — registrarlas en `docs/mejoras-pendientes.md` y seguir con el módulo en curso.

### Cuándo registrar una mejora
- Cuando surja una idea durante el desarrollo de un módulo
- Cuando el usuario mencione algo que no está en el PRD
- Cuando se detecte una limitación del diseño actual que podría mejorarse
- Cuando haya una optimización técnica que conviene hacer después

### Formato de registro en `docs/mejoras-pendientes.md`

```markdown
## [FECHA] Nombre corto de la mejora
- Módulo relacionado: X.X
- Descripción: qué es y por qué sería útil
- Prioridad sugerida: alta / media / baja
- Origen: surgió durante desarrollo / lo mencionó el usuario / detección propia
```

### Regla crítica
**Nunca interrumpir un módulo en curso para implementar una mejora no planificada.**
Registrar en `docs/mejoras-pendientes.md` y continuar. Las mejoras se revisan al cerrar cada fase.