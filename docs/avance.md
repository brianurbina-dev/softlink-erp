# Registro de avance — ERP Chile

Actualizar este archivo al cerrar cada módulo.
Claude Code lo lee para saber qué está hecho y qué viene.

---

## Estado general

| Fase | Módulos | Estado |
|------|---------|--------|
| Fase 1 — Core | 1.1, 1.2, 1.3 | 🔄 En progreso |
| Fase 2 — DTE | 2.1, 2.2, 2.3, 2.4, 2.5 | 🔲 Pendiente |
| Fase 3 — Inventario | 3.1, 3.2, 3.3 | 🔲 Pendiente |
| Fase 4 — Compras | 4.1, 4.2 | 🔲 Pendiente |
| Fase 5 — CRM | 5.1, 5.2, 5.3 | 🔲 Pendiente |
| Fase 6 — Reportes | 6.1, 6.2, 6.3 | 🔲 Pendiente |

---

## Módulos cerrados

_Ninguno aún._

---

## Módulo en progreso

### Módulo 1.1 — Infraestructura y setup
- Estado: 🔄 EN PROGRESO
- Inicio: 29/04/2026

**Completado:**
- [x] Next.js 14.2.35 con TypeScript, App Router, src/ dir
- [x] Tailwind CSS configurado con colores Softlink ERP (tokens `sl-*`)
- [x] shadcn/ui configurado (`components.json`, dependencias base)
- [x] Prisma 7.8.0 + @prisma/client instalados
- [x] Schema público definido en `prisma/schema.prisma` (empresas, usuarios, empresa_usuario, dte_config)
- [x] `prisma.config.ts` configurado con DIRECT_URL para migraciones Supabase
- [x] Variables de entorno documentadas en `.env.example`
- [x] Estructura de carpetas `src/` creada exactamente según CLAUDE.md
- [x] ESLint configurado (next/core-web-vitals + next/typescript)
- [x] Prettier configurado con prettier-plugin-tailwindcss
- [x] Archivos base: `src/lib/utils.ts`, `src/lib/chile/rut.ts`, `src/lib/chile/impuestos.ts`
- [x] `src/types/index.ts` con tipos globales y Result pattern
- [x] Interfaz `DTEService` y estructura `SimpleAPIAdapter` (stub)
- [x] TypeScript compila sin errores

**Pendiente para cerrar el módulo:**
- [ ] Deploy inicial en Vercel funcionando
- [ ] BD conectada (requiere credenciales Supabase del usuario)

---

## Notas y decisiones tomadas en el camino

### 29/04/2026 — Prisma 7 (breaking change)
El módulo `npx create-next-app@14` instaló Prisma 7.8.0 (no v5 como en la mayoría de tutoriales).
Prisma 7 no permite `url` ni `directUrl` en `schema.prisma` — se configuran en `prisma.config.ts`.
El cliente `@prisma/client` se instancia sin `datasourceUrl` explícito; lee `DATABASE_URL` del entorno.
La DIRECT_URL (para migraciones que bypasean pgBouncer de Supabase) va en `prisma.config.ts`.
