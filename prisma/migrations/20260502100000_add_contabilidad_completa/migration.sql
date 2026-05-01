-- ============================================================
-- Migración: Fase 7 — Contabilidad completa
-- Aplica a todos los schemas de empresa existentes en Supabase
-- Ejecutar en Supabase SQL Editor
-- ============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schema_name FROM public.empresas
  LOOP

    -- 7.1 Plan de cuentas (si no existe de migración anterior)
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.plan_cuentas (
        id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        codigo            TEXT NOT NULL,
        nombre            TEXT NOT NULL,
        tipo              TEXT NOT NULL,
        subtipo           TEXT,
        cuenta_padre_id   TEXT REFERENCES %I.plan_cuentas(id),
        acepta_movimientos BOOLEAN NOT NULL DEFAULT true,
        activo            BOOLEAN NOT NULL DEFAULT true,
        creado_en         TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(codigo)
      )', r.schema_name, r.schema_name);

    -- 7.2 Asientos contables
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.asientos (
        id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
        descripcion     TEXT NOT NULL,
        referencia_tipo TEXT,
        referencia_id   TEXT,
        automatico      BOOLEAN NOT NULL DEFAULT false,
        creado_en       TIMESTAMP NOT NULL DEFAULT NOW()
      )', r.schema_name);

    -- 7.2 Líneas de asientos (partida doble)
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.asiento_lineas (
        id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        asiento_id TEXT NOT NULL REFERENCES %I.asientos(id) ON DELETE CASCADE,
        cuenta_id  TEXT NOT NULL REFERENCES %I.plan_cuentas(id),
        debe       INTEGER NOT NULL DEFAULT 0,
        haber      INTEGER NOT NULL DEFAULT 0
      )', r.schema_name, r.schema_name, r.schema_name);

    -- 7.3 Reglas contables automáticas
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.reglas_contables (
        id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        evento      TEXT NOT NULL,
        cuenta_id   TEXT NOT NULL REFERENCES %I.plan_cuentas(id),
        tipo        TEXT NOT NULL,
        campo_monto TEXT NOT NULL,
        orden       INTEGER NOT NULL DEFAULT 0,
        activo      BOOLEAN NOT NULL DEFAULT true,
        creado_en   TIMESTAMP NOT NULL DEFAULT NOW()
      )', r.schema_name, r.schema_name);

    RAISE NOTICE 'Schema % migrado OK', r.schema_name;
  END LOOP;
END;
$$;

-- ============================================================
-- Verificación: muestra las tablas creadas por schema
-- ============================================================
SELECT
  table_schema,
  table_name,
  'OK' AS estado
FROM information_schema.tables
WHERE table_schema IN (SELECT schema_name FROM public.empresas)
  AND table_name IN ('plan_cuentas', 'asientos', 'asiento_lineas', 'reglas_contables')
ORDER BY table_schema, table_name;
