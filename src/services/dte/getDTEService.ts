import { prisma } from "@/lib/db/prisma"
import { SimpleAPIAdapter } from "./adapters/SimpleAPIAdapter"
import type { DTEService } from "./DTEService"

export async function getDTEService(empresaId: string): Promise<DTEService | null> {
  const [config, empresa] = await Promise.all([
    prisma.dteConfig.findUnique({ where: { empresaId } }),
    prisma.empresa.findUnique({ where: { id: empresaId } }),
  ])

  if (!config?.apiKey || !empresa) return null

  switch (config.proveedor) {
    case "simpleapi":
      return new SimpleAPIAdapter({
        apiKey: config.apiKey,
        ambiente: config.ambiente as "certificacion" | "produccion",
        rutEmpresa: empresa.rut,
        rutCertificado: config.rutCertificado ?? empresa.rut,
        razonSocial: empresa.razonSocial,
        giro: empresa.giro ?? "Actividades del giro",
        direccion: empresa.direccion ?? "",
        comuna: empresa.ciudad ?? "",
        telefono: empresa.telefono ?? "",
        actividadEconomica: empresa.actividadesEconomicas.length
          ? empresa.actividadesEconomicas
          : [620200],
        certPassword: config.certificadoPassword ?? null,
        certBase64: config.certificado ?? null,
        numeroResolucion: config.numeroResolucion ?? 0,
        fechaResolucion: config.fechaResolucion ?? "2023-01-10",
      })
    default:
      return null
  }
}
