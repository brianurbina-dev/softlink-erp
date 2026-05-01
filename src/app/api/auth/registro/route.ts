import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { prisma } from "@/lib/db/prisma"
import { crearSchemaEmpresa } from "@/lib/db/empresa-schema"
import { registroSchema } from "@/lib/validations/auth"
import { formatRutStorage } from "@/lib/chile/rut"
import type { ApiResponse } from "@/types"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = registroSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json<ApiResponse>(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { nombre, email, password, rutEmpresa, razonSocial, plan } = parsed.data
    const rutFormateado = formatRutStorage(rutEmpresa)

    // Verificar que el RUT de empresa no esté registrado
    const empresaExistente = await prisma.empresa.findUnique({
      where: { rut: rutFormateado },
    })
    if (empresaExistente) {
      return NextResponse.json<ApiResponse>(
        { error: "Este RUT de empresa ya está registrado" },
        { status: 409 }
      )
    }

    const supabaseAdmin = createAdminClient()

    // Crear usuario en Supabase Auth (sin email confirmation para MVP)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      if (authError?.message.includes("already")) {
        return NextResponse.json<ApiResponse>(
          { error: "Este email ya está registrado" },
          { status: 409 }
        )
      }
      return NextResponse.json<ApiResponse>({ error: "Error al crear cuenta" }, { status: 500 })
    }

    // Generar nombre de schema único
    const schemaName = `empresa_${authData.user.id.replace(/-/g, "").slice(0, 16)}`

    // Crear todas las entidades en una transacción Prisma
    const { empresa, usuario } = await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          authUserId: authData.user.id,
          email,
          nombre,
          rolGlobal: "admin",
        },
      })

      const empresa = await tx.empresa.create({
        data: {
          rut: rutFormateado,
          razonSocial,
          schemaName,
          plan,
          dteConfig: {
            create: { proveedor: "simpleapi", ambiente: "certificacion" },
          },
        },
      })

      await tx.empresaUsuario.create({
        data: {
          empresaId: empresa.id,
          usuarioId: usuario.id,
          rol: "admin",
        },
      })

      return { empresa, usuario }
    })

    // Crear schema PostgreSQL de la empresa (operación DDL, fuera de la transacción Prisma)
    await crearSchemaEmpresa(schemaName)

    return NextResponse.json<ApiResponse>({
      data: { empresaId: empresa.id, usuarioId: usuario.id },
    })
  } catch (error) {
    console.error("[registro] Error:", error)
    return NextResponse.json<ApiResponse>({ error: "Error interno del servidor" }, { status: 500 })
  }
}
