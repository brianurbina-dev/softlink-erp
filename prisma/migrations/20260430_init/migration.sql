-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "rut" TEXT NOT NULL,
    "razon_social" TEXT NOT NULL,
    "schema_name" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "auth_user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol_global" TEXT NOT NULL DEFAULT 'user',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresa_usuario" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'admin',

    CONSTRAINT "empresa_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dte_config" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL DEFAULT 'simpleapi',
    "api_key" TEXT,
    "certificado" TEXT,
    "certificado_nombre" TEXT,
    "certificado_password" TEXT,
    "ambiente" TEXT NOT NULL DEFAULT 'certificacion',

    CONSTRAINT "dte_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresas_rut_key" ON "empresas"("rut");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_schema_name_key" ON "empresas"("schema_name");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_auth_user_id_key" ON "usuarios"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "empresa_usuario_empresa_id_usuario_id_key" ON "empresa_usuario"("empresa_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "dte_config_empresa_id_key" ON "dte_config"("empresa_id");

-- AddForeignKey
ALTER TABLE "empresa_usuario" ADD CONSTRAINT "empresa_usuario_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresa_usuario" ADD CONSTRAINT "empresa_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dte_config" ADD CONSTRAINT "dte_config_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
