-- Agrega actividades_economicas a empresas
-- Códigos CIIU (Actividad Económica SII) requeridos para emitir DTE
-- Ejecutar en Supabase → SQL Editor

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS actividades_economicas integer[] NOT NULL DEFAULT '{}';

SELECT 'Migration 20260503000000 completed' AS status;
