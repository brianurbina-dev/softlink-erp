-- Agrega la tabla crm_actividades a todos los schemas de empresa existentes.
-- Ejecutar en Supabase → SQL Editor.

DO $$
DECLARE
  sch TEXT;
BEGIN
  FOR sch IN SELECT schema_name FROM public.empresas
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = sch AND table_name = 'crm_actividades'
    ) THEN
      EXECUTE format(
        'CREATE TABLE %I.crm_actividades (
          id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          oportunidad_id TEXT NOT NULL REFERENCES %I.oportunidades(id) ON DELETE CASCADE,
          tipo           TEXT NOT NULL DEFAULT ''nota'',
          descripcion    TEXT NOT NULL,
          fecha          DATE NOT NULL DEFAULT CURRENT_DATE,
          completada     BOOLEAN NOT NULL DEFAULT false,
          creado_en      TIMESTAMP NOT NULL DEFAULT NOW()
        )', sch, sch
      );
    END IF;
  END LOOP;
END $$;
