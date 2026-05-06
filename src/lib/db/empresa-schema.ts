import { Pool } from "pg"

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DIRECT_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
    })
  }
  return pool
}

/** Crea el schema PostgreSQL de una empresa con todas sus tablas operacionales. */
export async function crearSchemaEmpresa(schemaName: string): Promise<void> {
  if (!/^empresa_[a-z0-9]+$/.test(schemaName)) {
    throw new Error(`Schema name inválido: ${schemaName}`)
  }

  const client = await getPool().connect()
  try {
    await client.query("BEGIN")

    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)

    await client.query(`
      CREATE TABLE "${schemaName}".clientes (
        id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        rut         TEXT NOT NULL UNIQUE,
        razon_social TEXT NOT NULL,
        giro        TEXT,
        email       TEXT,
        telefono    TEXT,
        direccion   TEXT,
        ciudad      TEXT,
        activo      BOOLEAN NOT NULL DEFAULT true,
        creado_en   TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE "${schemaName}".proveedores (
        id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        rut         TEXT NOT NULL UNIQUE,
        razon_social TEXT NOT NULL,
        giro        TEXT,
        email       TEXT,
        telefono    TEXT,
        direccion   TEXT,
        ciudad      TEXT,
        activo      BOOLEAN NOT NULL DEFAULT true,
        creado_en   TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE "${schemaName}".productos (
        id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        codigo       TEXT NOT NULL UNIQUE,
        nombre       TEXT NOT NULL,
        descripcion  TEXT,
        precio       INTEGER NOT NULL DEFAULT 0,
        costo        INTEGER NOT NULL DEFAULT 0,
        unidad       TEXT NOT NULL DEFAULT 'UN',
        afecto_iva   BOOLEAN NOT NULL DEFAULT true,
        stock_minimo INTEGER NOT NULL DEFAULT 0,
        activo       BOOLEAN NOT NULL DEFAULT true,
        creado_en    TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE "${schemaName}".bodegas (
        id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        nombre      TEXT NOT NULL,
        descripcion TEXT,
        activa      BOOLEAN NOT NULL DEFAULT true,
        creado_en   TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE "${schemaName}".facturas (
        id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        tipo       INTEGER NOT NULL,
        folio      INTEGER,
        fecha      DATE NOT NULL DEFAULT CURRENT_DATE,
        cliente_id TEXT NOT NULL REFERENCES "${schemaName}".clientes(id),
        neto       INTEGER NOT NULL DEFAULT 0,
        iva        INTEGER NOT NULL DEFAULT 0,
        total      INTEGER NOT NULL DEFAULT 0,
        estado          TEXT NOT NULL DEFAULT 'borrador',
        referencia_tipo  INTEGER,
        referencia_folio INTEGER,
        referencia_razon TEXT,
        track_id         TEXT,
        xml_url          TEXT,
        pdf_url          TEXT,
        creado_en        TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE "${schemaName}".factura_items (
        id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        factura_id      TEXT NOT NULL REFERENCES "${schemaName}".facturas(id) ON DELETE CASCADE,
        producto_id     TEXT REFERENCES "${schemaName}".productos(id),
        descripcion     TEXT NOT NULL,
        cantidad        INTEGER NOT NULL DEFAULT 1,
        precio_unitario INTEGER NOT NULL DEFAULT 0,
        descuento       INTEGER NOT NULL DEFAULT 0,
        subtotal        INTEGER NOT NULL DEFAULT 0
      )
    `)

    await client.query(`
      CREATE TABLE "${schemaName}".inventario (
        id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        producto_id     TEXT NOT NULL REFERENCES "${schemaName}".productos(id),
        bodega_id       TEXT NOT NULL REFERENCES "${schemaName}".bodegas(id),
        stock_actual    INTEGER NOT NULL DEFAULT 0,
        costo_promedio  INTEGER NOT NULL DEFAULT 0,
        actualizado_en  TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(producto_id, bodega_id)
      )
    `)

    await client.query(`
      CREATE TABLE "${schemaName}".movimientos_inv (
        id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        tipo            TEXT NOT NULL,
        producto_id     TEXT NOT NULL REFERENCES "${schemaName}".productos(id),
        bodega_id       TEXT NOT NULL REFERENCES "${schemaName}".bodegas(id),
        cantidad        INTEGER NOT NULL,
        costo_unitario  INTEGER NOT NULL DEFAULT 0,
        referencia_tipo TEXT,
        referencia_id   TEXT,
        notas           TEXT,
        creado_en       TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE "${schemaName}".oportunidades (
        id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        cliente_id            TEXT REFERENCES "${schemaName}".clientes(id),
        titulo                TEXT NOT NULL,
        descripcion           TEXT,
        valor_estimado        INTEGER NOT NULL DEFAULT 0,
        etapa                 TEXT NOT NULL DEFAULT 'prospecto',
        fecha_cierre_estimada DATE,
        creado_en             TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE "${schemaName}".compras (
        id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        proveedor_id TEXT NOT NULL REFERENCES "${schemaName}".proveedores(id),
        fecha        DATE NOT NULL DEFAULT CURRENT_DATE,
        estado       TEXT NOT NULL DEFAULT 'borrador',
        neto         INTEGER NOT NULL DEFAULT 0,
        iva          INTEGER NOT NULL DEFAULT 0,
        total        INTEGER NOT NULL DEFAULT 0,
        notas        TEXT,
        creado_en    TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE "${schemaName}".compra_items (
        id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        compra_id       TEXT NOT NULL REFERENCES "${schemaName}".compras(id) ON DELETE CASCADE,
        producto_id     TEXT REFERENCES "${schemaName}".productos(id),
        descripcion     TEXT NOT NULL,
        cantidad        INTEGER NOT NULL DEFAULT 1,
        precio_unitario INTEGER NOT NULL DEFAULT 0,
        subtotal        INTEGER NOT NULL DEFAULT 0
      )
    `)

    await client.query(`
      CREATE TABLE "${schemaName}".crm_actividades (
        id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        oportunidad_id TEXT NOT NULL REFERENCES "${schemaName}".oportunidades(id) ON DELETE CASCADE,
        tipo           TEXT NOT NULL DEFAULT 'nota',
        descripcion    TEXT NOT NULL,
        fecha          DATE NOT NULL DEFAULT CURRENT_DATE,
        completada     BOOLEAN NOT NULL DEFAULT false,
        creado_en      TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE "${schemaName}".guias (
        id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        folio                INTEGER,
        fecha                DATE NOT NULL DEFAULT CURRENT_DATE,
        tipo_traslado        INTEGER NOT NULL DEFAULT 1,
        cliente_id           TEXT REFERENCES "${schemaName}".clientes(id),
        direccion_destino    TEXT,
        transportista_rut    TEXT,
        transportista_nombre TEXT,
        patente              TEXT,
        neto                 INTEGER NOT NULL DEFAULT 0,
        iva                  INTEGER NOT NULL DEFAULT 0,
        total                INTEGER NOT NULL DEFAULT 0,
        estado               TEXT NOT NULL DEFAULT 'borrador',
        factura_id           TEXT,
        ref_factura_id       TEXT,
        ref_tipo             INTEGER,
        ref_folio            INTEGER,
        track_id             TEXT,
        pdf_url              TEXT,
        creado_en            TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE "${schemaName}".guia_items (
        id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        guia_id         TEXT NOT NULL REFERENCES "${schemaName}".guias(id) ON DELETE CASCADE,
        producto_id     TEXT REFERENCES "${schemaName}".productos(id),
        descripcion     TEXT NOT NULL,
        cantidad        INTEGER NOT NULL DEFAULT 1,
        precio_unitario INTEGER NOT NULL DEFAULT 0,
        descuento       INTEGER NOT NULL DEFAULT 0,
        subtotal        INTEGER NOT NULL DEFAULT 0
      )
    `)

    await client.query(`
      CREATE TABLE "${schemaName}".boletas (
        id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        folio           INTEGER,
        fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
        receptor_rut    TEXT,
        receptor_nombre TEXT,
        neto            INTEGER NOT NULL DEFAULT 0,
        iva             INTEGER NOT NULL DEFAULT 0,
        total           INTEGER NOT NULL DEFAULT 0,
        estado          TEXT NOT NULL DEFAULT 'borrador',
        track_id        TEXT,
        pdf_url         TEXT,
        creado_en       TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE "${schemaName}".boleta_items (
        id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        boleta_id       TEXT NOT NULL REFERENCES "${schemaName}".boletas(id) ON DELETE CASCADE,
        producto_id     TEXT REFERENCES "${schemaName}".productos(id),
        descripcion     TEXT NOT NULL,
        cantidad        INTEGER NOT NULL DEFAULT 1,
        precio_unitario INTEGER NOT NULL DEFAULT 0,
        descuento       INTEGER NOT NULL DEFAULT 0,
        subtotal        INTEGER NOT NULL DEFAULT 0
      )
    `)

    await client.query(`
      CREATE TABLE "${schemaName}".plan_cuentas (
        id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        codigo            TEXT NOT NULL,
        nombre            TEXT NOT NULL,
        tipo              TEXT NOT NULL,
        subtipo           TEXT,
        cuenta_padre_id   TEXT REFERENCES "${schemaName}".plan_cuentas(id),
        acepta_movimientos BOOLEAN NOT NULL DEFAULT true,
        activo            BOOLEAN NOT NULL DEFAULT true,
        creado_en         TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(codigo)
      )
    `)

    await client.query(`
      CREATE TABLE "${schemaName}".asientos (
        id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
        descripcion     TEXT NOT NULL,
        referencia_tipo TEXT,
        referencia_id   TEXT,
        automatico      BOOLEAN NOT NULL DEFAULT false,
        creado_en       TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE "${schemaName}".asiento_lineas (
        id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        asiento_id TEXT NOT NULL REFERENCES "${schemaName}".asientos(id) ON DELETE CASCADE,
        cuenta_id  TEXT NOT NULL REFERENCES "${schemaName}".plan_cuentas(id),
        debe       INTEGER NOT NULL DEFAULT 0,
        haber      INTEGER NOT NULL DEFAULT 0
      )
    `)

    await client.query(`
      CREATE TABLE "${schemaName}".reglas_contables (
        id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        evento      TEXT NOT NULL,
        cuenta_id   TEXT NOT NULL REFERENCES "${schemaName}".plan_cuentas(id),
        tipo        TEXT NOT NULL,
        campo_monto TEXT NOT NULL,
        orden       INTEGER NOT NULL DEFAULT 0,
        activo      BOOLEAN NOT NULL DEFAULT true,
        creado_en   TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE "${schemaName}".caf (
        id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        tipo_dte         INTEGER NOT NULL,
        folio_desde      INTEGER NOT NULL,
        folio_hasta      INTEGER NOT NULL,
        folio_actual     INTEGER NOT NULL,
        folio_pendiente  INTEGER,
        xml_contenido    TEXT NOT NULL,
        activo           BOOLEAN NOT NULL DEFAULT true,
        creado_en        TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
