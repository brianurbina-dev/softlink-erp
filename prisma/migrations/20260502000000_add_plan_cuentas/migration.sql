-- Migración: agrega tabla plan_cuentas a todos los schemas de empresa existentes
-- Ejecutar en Supabase SQL Editor

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schema_name FROM empresas
  LOOP
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
  END LOOP;
END;
$$;
