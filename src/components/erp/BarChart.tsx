"use client"

interface BarData {
  label: string
  value: number
  highlight?: boolean
}

interface BarChartProps {
  data: BarData[]
  height?: number
  formatValue?: (n: number) => string
  color?: string
  highlightColor?: string
}

export function BarChart({
  data,
  height = 160,
  formatValue = (n) => n.toLocaleString("es-CL"),
  color = "rgba(127,119,221,0.35)",
  highlightColor = "#7F77DD",
}: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <div className="select-none">
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d, i) => {
          const pct = max > 0 ? (d.value / max) * 100 : 0
          const isHighlight = d.highlight ?? false
          return (
            <div key={i} className="group relative flex flex-1 flex-col items-center justify-end">
              {/* Tooltip */}
              <div className="pointer-events-none absolute bottom-full mb-1.5 hidden rounded bg-sl-bg-card border border-sl-border px-2 py-1 text-xs text-sl-text shadow-lg whitespace-nowrap group-hover:block z-10">
                <span className="font-medium">{d.label}</span>
                <span className="mx-1 text-sl-muted">·</span>
                {formatValue(d.value)}
              </div>
              {/* Barra */}
              <div
                className="w-full rounded-t transition-all duration-300"
                style={{
                  height: `${Math.max(pct, d.value > 0 ? 3 : 0)}%`,
                  background: isHighlight ? highlightColor : color,
                }}
              />
            </div>
          )
        })}
      </div>
      {/* Etiquetas */}
      <div className="mt-1.5 flex gap-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-sl-muted truncate">{d.label}</div>
        ))}
      </div>
    </div>
  )
}
