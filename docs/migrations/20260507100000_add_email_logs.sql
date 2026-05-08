-- Migration: 20260507100000_add_email_logs
-- Agrega tabla email_logs a todos los schemas de empresa

DO $$
DECLARE
  schema_record RECORD;
BEGIN
  FOR schema_record IN SELECT schema_name FROM public.empresas LOOP
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.email_logs (
        id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        documento_tipo  VARCHAR(20) NOT NULL,
        documento_id    UUID        NOT NULL,
        tipo_dte        INTEGER     NOT NULL,
        folio           INTEGER,
        destinatario    TEXT        NOT NULL,
        asunto          TEXT        NOT NULL DEFAULT '''',
        estado          VARCHAR(25) NOT NULL DEFAULT ''enviado'',
        resend_id       TEXT,
        error_mensaje   TEXT,
        creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )', schema_record.schema_name);

    EXECUTE format('
      CREATE INDEX IF NOT EXISTS email_logs_documento_id_idx
        ON %I.email_logs (documento_id)', schema_record.schema_name);

    EXECUTE format('
      CREATE INDEX IF NOT EXISTS email_logs_creado_en_idx
        ON %I.email_logs (creado_en DESC)', schema_record.schema_name);

    RAISE NOTICE 'email_logs creado en schema %', schema_record.schema_name;
  END LOOP;
END $$;
