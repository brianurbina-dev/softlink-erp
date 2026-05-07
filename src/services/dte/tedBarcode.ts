// eslint-disable-next-line @typescript-eslint/no-require-imports
const bwipjs = require("bwip-js") as { toBuffer: (opts: Record<string, unknown>) => Promise<Buffer> }

export function extractTed(dteXml: string): string | null {
  const match = dteXml.match(/<TED[\s\S]*?<\/TED>/)
  return match ? match[0] : null
}

export async function generateTedBarcode(tedXml: string): Promise<string | null> {
  try {
    const png = await bwipjs.toBuffer({
      bcid: "pdf417",
      text: tedXml,
      scale: 2,
      height: 10,
      includetext: false,
    })
    return `data:image/png;base64,${png.toString("base64")}`
  } catch (err) {
    console.error("[TED] PDF417 generation failed:", err)
    return null
  }
}

export async function extractAndGenerateBarcode(dteXml: string | undefined): Promise<string | null> {
  if (!dteXml) return null
  const ted = extractTed(dteXml)
  if (!ted) return null
  return generateTedBarcode(ted)
}
