"use client"

import { useEffect, useRef, useState } from "react"
import { Download, HelpCircle, X, Loader2, AlertCircle } from "lucide-react"

interface XmlViewerModalProps {
  xmlUrl: string        // e.g. /api/facturas/[id]/xml
  downloadUrl: string   // e.g. /api/facturas/[id]/xml?download=1
  titulo: string
  onClose: () => void
}

// ─── Pretty-print ────────────────────────────────────────────────────────────

function prettyXml(raw: string): string {
  const IND = "  "
  let depth = 0
  let out = ""
  const rx = /(<[^>]+>)|([^<]+)/g
  let m: RegExpExecArray | null
  while ((m = rx.exec(raw)) !== null) {
    const [, tag, text] = m
    if (tag) {
      if (tag.startsWith("</")) {
        depth = Math.max(0, depth - 1)
        out += "\n" + IND.repeat(depth) + tag
      } else if (tag.startsWith("<?") || tag.startsWith("<!")) {
        out += (out ? "\n" : "") + IND.repeat(depth) + tag
      } else if (tag.endsWith("/>")) {
        out += "\n" + IND.repeat(depth) + tag
      } else {
        out += "\n" + IND.repeat(depth) + tag
        depth++
      }
    } else if (text) {
      const t = text.trim()
      if (t) out += t
    }
  }
  return out.trimStart()
}

// ─── Syntax highlight ────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

const C = {
  bracket:  "color:#64748b",
  tag:      "color:#38bdf8",
  closeTag: "color:#7dd3fc",
  attr:     "color:#4ade80",
  value:    "color:#fb923c",
  text:     "color:#cbd5e1",
  pi:       "color:#c084fc",
  comment:  "color:#6b7280;font-style:italic",
}

function span(style: string, content: string): string {
  return `<span style="${style}">${content}</span>`
}

function highlightXml(xml: string): string {
  return xml.replace(
    /(<\?[^>]*>)|(<!--[\s\S]*?-->)|(<\/[\w:.-]+>)|(<[\w:.-][^>]*\/?>)|([^<\n]+)/g,
    (_, pi, comment, close, open, text) => {
      if (pi) return span(C.pi, esc(pi))

      if (comment) return span(C.comment, esc(comment))

      if (close) {
        const e = esc(close)
        return e.replace(
          /^(&lt;)(\/[\w:.-]+)(&gt;)$/,
          span(C.bracket, "$1") + span(C.closeTag, "$2") + span(C.bracket, "$3")
        )
      }

      if (open) {
        let e = esc(open)
        // tag name
        e = e.replace(
          /^(&lt;)([\w:.-]+)/,
          span(C.bracket, "$1") + span(C.tag, "$2")
        )
        // attributes name="value"
        e = e.replace(
          /([\w:.-]+)(=&quot;)([^&]*)(&quot;)/g,
          span(C.attr, "$1") +
          span(C.bracket, "$2") +
          span(C.value, "$3") +
          span(C.bracket, "$4")
        )
        // closing bracket
        e = e.replace(/(\/?)(&gt;)$/, span(C.bracket, "$1$2"))
        return e
      }

      if (text) {
        const t = text.trim()
        return t ? span(C.text, esc(text)) : text
      }

      return esc(_ || "")
    }
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function XmlViewerModal({ xmlUrl, downloadUrl, titulo, onClose }: XmlViewerModalProps) {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const infoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showInfo) return
    function handler(e: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setShowInfo(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showInfo])

  useEffect(() => {
    fetch(xmlUrl)
      .then((r) => {
        if (!r.ok) return r.text().then((t) => { throw new Error(t || "Error al cargar XML") })
        return r.text()
      })
      .then((raw) => {
        setHtml(highlightXml(prettyXml(raw)))
        setLoading(false)
      })
      .catch((e: Error) => {
        setError(e.message)
        setLoading(false)
      })
  }, [xmlUrl])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-[90vw] max-w-5xl flex-col overflow-hidden rounded-xl border border-sl-border bg-sl-bg-card shadow-2xl"
        style={{ height: "88vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-sl-border px-4 py-3">
          <span className="text-sm font-medium text-sl-text">{titulo}</span>
          <div className="flex items-center gap-2">
            <div className="relative" ref={infoRef}>
              <button
                onClick={() => setShowInfo((v) => !v)}
                className="rounded-lg p-1.5 text-sl-muted transition-colors hover:bg-sl-border/40 hover:text-sl-purple-light"
                aria-label="Información sobre el XML"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
              {showInfo && (
                <div className="absolute right-0 top-full z-10 mt-2 w-72 rounded-lg border border-sl-border bg-sl-bg-card p-3 shadow-xl">
                  <p className="text-xs leading-relaxed text-sl-muted">
                    Archivo XML correspondiente al Documento Tributario Electrónico (DTE), utilizado para validación, envío y respaldo ante el SII.
                  </p>
                </div>
              )}
            </div>
            <a
              href={downloadUrl}
              className="flex items-center gap-1.5 rounded-lg border border-sl-border px-3 py-1.5 text-xs text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-purple-light"
            >
              <Download className="h-3.5 w-3.5" /> Descargar XML
            </a>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-sl-muted transition-colors hover:bg-sl-border/40 hover:text-sl-text"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-auto bg-[#0d1117] p-4">
          {loading && (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-sl-muted" />
            </div>
          )}
          {error && (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <AlertCircle className="h-6 w-6 text-sl-danger" />
              <p className="text-sm text-sl-muted">{error}</p>
            </div>
          )}
          {html && (
            <pre
              className="font-mono text-xs leading-relaxed"
              style={{ tabSize: 2 }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
