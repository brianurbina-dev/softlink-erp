-- Agrega campos de perfil a empresas y sistema de permisos a empresa_usuario
-- Ejecutar en Supabase → SQL Editor

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS giro           TEXT,
  ADD COLUMN IF NOT EXISTS logo_url       TEXT,
  ADD COLUMN IF NOT EXISTS telefono       TEXT,
  ADD COLUMN IF NOT EXISTS email_contacto TEXT,
  ADD COLUMN IF NOT EXISTS web            TEXT,
  ADD COLUMN IF NOT EXISTS direccion      TEXT,
  ADD COLUMN IF NOT EXISTS ciudad         TEXT;

ALTER TABLE public.empresa_usuario
  ADD COLUMN IF NOT EXISTS permisos TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS activo   BOOLEAN NOT NULL DEFAULT true;

SELECT 'Migration 20260502200000 completed' AS status;
