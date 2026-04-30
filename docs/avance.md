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

## Módulo en progreso

_Ninguno. Listo para comenzar Módulo 1.2 — Autenticación y sesión._

---

## Notas y decisiones tomadas en el camino

### 30/04/2026 — Prisma 7 (breaking change)
Prisma 7.8.0 no permite `url` ni `directUrl` en `schema.prisma`.
Se configura en `prisma.config.ts`. El cliente lee `DATABASE_URL` del entorno automáticamente.
Para migraciones Supabase usar `DIRECT_URL` apuntando a `db.[ref].supabase.co:5432` con usuario `postgres`.

### 30/04/2026 — Deploy Vercel diferido
Se decidió no deployar en Vercel durante el Módulo 1.1.
El deploy se hará cuando haya una versión estable con autenticación funcionando.
Vercel se conecta a GitHub en 5 minutos cuando sea necesario.
