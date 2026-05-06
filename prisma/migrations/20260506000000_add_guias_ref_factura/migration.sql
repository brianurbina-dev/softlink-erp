-- Agrega columnas de referencia a factura existente en la tabla guias
DO $$
DECLARE
  schema_rec RECORD;
BEGIN
  FOR schema_rec IN
    SELECT schema_name FROM public.empresas WHERE schema_name IS NOT NULL
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = schema_rec.schema_name) THEN
      EXECUTE format('ALTER TABLE %I.guias ADD COLUMN IF NOT EXISTS ref_factura_id TEXT', schema_rec.schema_name);
      EXECUTE format('ALTER TABLE %I.guias ADD COLUMN IF NOT EXISTS ref_tipo INTEGER', schema_rec.schema_name);
      EXECUTE format('ALTER TABLE %I.guias ADD COLUMN IF NOT EXISTS ref_folio INTEGER', schema_rec.schema_name);
    END IF;
  END LOOP;
END $$;
