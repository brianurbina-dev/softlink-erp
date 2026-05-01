-- Agrega columnas de referencia a facturas en todos los schemas de empresa.
-- Ejecutar en Supabase → SQL Editor.

DO $$
DECLARE
  sch TEXT;
BEGIN
  FOR sch IN SELECT schema_name FROM public.empresas
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = sch AND table_name = 'facturas' AND column_name = 'referencia_tipo'
    ) THEN
      EXECUTE format('ALTER TABLE %I.facturas ADD COLUMN referencia_tipo  INTEGER', sch);
      EXECUTE format('ALTER TABLE %I.facturas ADD COLUMN referencia_folio INTEGER', sch);
      EXECUTE format('ALTER TABLE %I.facturas ADD COLUMN referencia_razon TEXT', sch);
    END IF;
  END LOOP;
END $$;
