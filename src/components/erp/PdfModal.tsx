"use client"

import { useRef, useState } from "react"
import { Download, Info, X } from "lucide-react"

interface PdfModalProps {
  url: string
  titulo: string
  onClose: () => void
  isPreview?: boolean
}

export function PdfModal({ url, titulo, onClose, isPreview }: PdfModalProps) {
  const [showInfo, setShowInfo] = useState(false)
  const infoRef = useRef<HTMLDivElement>(null)

  function handleInfoToggle() {
    setShowInfo((v) => {
      if (!v) {
        setTimeout(() => {
          function handler(e: MouseEvent) {
            if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
              setShowInfo(false)
              document.removeEventListener("mousedown", handler)
            }
          }
          document.addEventListener("mousedown", handler)
        }, 0)
      }
      return !v
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-[95vw] max-w-6xl flex-col overflow-hidden rounded-xl border border-sl-border bg-sl-bg-card shadow-2xl"
        style={{ height: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-sl-border px-4 py-3">
          <span className="text-sm font-medium text-sl-text">{titulo}</span>
          <div className="flex items-center gap-2">
            {isPreview && (
              <div className="relative" ref={infoRef}>
                <button
                  onClick={handleInfoToggle}
                  className="rounded-lg p-1.5 text-sl-muted transition-colors hover:bg-sl-border/40 hover:text-sl-purple-light"
                  aria-label="Información sobre la vista previa"
                >
                  <Info className="h-4 w-4" />
                </button>
                {showInfo && (
                  <div className="absolute right-0 top-full z-10 mt-2 w-72 rounded-lg border border-sl-border bg-sl-bg-card p-3 shadow-xl">
                    <p className="text-xs leading-relaxed text-sl-muted">
                      Este es un documento de vista previa generado localmente. No tiene ninguna validez ante el SII y no ha sido enviado ni timbrado.
                    </p>
                  </div>
                )}
              </div>
            )}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-sl-border px-3 py-1.5 text-xs text-sl-muted transition-colors hover:border-sl-purple/50 hover:text-sl-purple-light"
            >
              <Download className="h-3.5 w-3.5" /> Descargar
            </a>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-sl-muted transition-colors hover:bg-sl-border/40 hover:text-sl-text"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <iframe
          src={url}
          className="w-full bg-white"
          style={{ flex: "1 1 0", minHeight: 0 }}
          title={titulo}
        />
      </div>
    </div>
  )
}
