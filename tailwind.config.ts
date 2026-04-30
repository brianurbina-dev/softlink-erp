import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sl: {
          purple: "#7F77DD",
          "purple-light": "#AFA9EC",
          "purple-dark": "#534AB7",
          "bg-dark": "#0f0f14",
          "bg-card": "#16161f",
          "bg-sidebar": "#0b0b11",
          border: "#2a2a3a",
          text: "#f0f0f5",
          muted: "#888899",
          "card-light": "#ffffff",
          "bg-light": "#f4f4f8",
          "sidebar-light": "#1a1a2e",
          "border-light": "#e2e2ee",
          "text-light": "#1a1a2e",
          "muted-light": "#6b6b88",
          success: "#1D9E75",
          warning: "#BA7517",
          danger: "#E24B4A",
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      borderRadius: {
        card: "10px",
      },
      fontSize: {
        "page-title": ["18px", { fontWeight: "500" }],
      },
      width: {
        sidebar: "220px",
      },
      height: {
        topbar: "56px",
      },
    },
  },
  plugins: [],
}
export default config
