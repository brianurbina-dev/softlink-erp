-- Agrega las tablas boletas y boleta_items a todos los schemas de empresa existentes.
-- Ejecutar en Supabase → SQL Editor.

DO $$
DECLARE
  sch TEXT;
BEGIN
  FOR sch IN SELECT schema_name FROM public.empresas
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = sch AND table_name = 'boletas'
    ) THEN
      EXECUTE format(
        'CREATE TABLE %I.boletas (
          id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          folio           INTEGER,
          fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
          receptor_rut    TEXT,
          receptor_nombre TEXT,
          neto            INTEGER NOT NULL DEFAULT 0,
          iva             INTEGER NOT NULL DEFAULT 0,
          total           INTEGER NOT NULL DEFAULT 0,
          estado          TEXT NOT NULL DEFAULT ''borrador'',
          track_id        TEXT,
          pdf_url         TEXT,
          creado_en       TIMESTAMP NOT NULL DEFAULT NOW()
        )', sch
      );

      EXECUTE format(
        'CREATE TABLE %I.boleta_items (
          id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          boleta_id       TEXT NOT NULL REFERENCES %I.boletas(id) ON DELETE CASCADE,
          producto_id     TEXT REFERENCES %I.productos(id),
          descripcion     TEXT NOT NULL,
          cantidad        INTEGER NOT NULL DEFAULT 1,
          precio_unitario INTEGER NOT NULL DEFAULT 0,
          descuento       INTEGER NOT NULL DEFAULT 0,
          subtotal        INTEGER NOT NULL DEFAULT 0
        )', sch, sch, sch
      );
    END IF;
  END LOOP;
END $$;
