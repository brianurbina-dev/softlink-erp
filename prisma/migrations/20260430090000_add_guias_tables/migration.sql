-- Agrega las tablas guias y guia_items a todos los schemas de empresa existentes.
-- Ejecutar en Supabase → SQL Editor.

DO $$
DECLARE
  sch TEXT;
BEGIN
  FOR sch IN SELECT schema_name FROM public.empresas
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = sch AND table_name = 'guias'
    ) THEN
      EXECUTE format(
        'CREATE TABLE %I.guias (
          id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          folio                INTEGER,
          fecha                DATE NOT NULL DEFAULT CURRENT_DATE,
          tipo_traslado        INTEGER NOT NULL DEFAULT 1,
          cliente_id           TEXT REFERENCES %I.clientes(id),
          direccion_destino    TEXT,
          transportista_rut    TEXT,
          transportista_nombre TEXT,
          patente              TEXT,
          neto                 INTEGER NOT NULL DEFAULT 0,
          iva                  INTEGER NOT NULL DEFAULT 0,
          total                INTEGER NOT NULL DEFAULT 0,
          estado               TEXT NOT NULL DEFAULT ''borrador'',
          factura_id           TEXT,
          track_id             TEXT,
          pdf_url              TEXT,
          creado_en            TIMESTAMP NOT NULL DEFAULT NOW()
        )', sch, sch
      );

      EXECUTE format(
        'CREATE TABLE %I.guia_items (
          id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          guia_id         TEXT NOT NULL REFERENCES %I.guias(id) ON DELETE CASCADE,
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
