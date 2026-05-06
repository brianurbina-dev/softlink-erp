-- Agrega campos de resolución SII a dte_config y tabla caf a todos los schemas de empresa
-- Ejecutar en Supabase → SQL Editor

-- 1. Campos de resolución en dte_config (necesarios para el sobre de envío al SII)
ALTER TABLE public.dte_config
  ADD COLUMN IF NOT EXISTS numero_resolucion INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fecha_resolucion  TEXT;

-- 2. Tabla caf en cada schema de empresa existente
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT schema_name FROM public.empresas LOOP
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.caf (
        id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        tipo_dte        INTEGER NOT NULL,
        folio_desde     INTEGER NOT NULL,
        folio_hasta     INTEGER NOT NULL,
        folio_actual    INTEGER NOT NULL,
        xml_contenido   TEXT NOT NULL,
        activo          BOOLEAN NOT NULL DEFAULT true,
        creado_en       TIMESTAMP NOT NULL DEFAULT NOW()
      )', rec.schema_name);
  END LOOP;
END;
$$;

SELECT 'Migration 20260502300000 completed' AS status;
