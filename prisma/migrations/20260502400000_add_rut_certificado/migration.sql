-- Agrega rut_certificado a dte_config
-- El RUT del titular del certificado PFX (puede diferir del RUT de la empresa)
-- Ejecutar en Supabase → SQL Editor

ALTER TABLE public.dte_config
  ADD COLUMN IF NOT EXISTS rut_certificado TEXT;

SELECT 'Migration 20260502400000 completed' AS status;
