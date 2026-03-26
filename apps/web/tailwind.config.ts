import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        /** Primary UI/body: Inter — strong screen legibility for long reads (e-learning) */
        sans: ['Inter', "system-ui", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      fontSize: {
        /** Material Design–style titles (slightly larger than default scale) */
        "md-title": ["1.5rem", { lineHeight: "2rem", fontWeight: "500" }],
        "md-headline": ["2rem", { lineHeight: "2.5rem", fontWeight: "500" }],
      },
      colors: {
        brand: {
          DEFAULT: "#00A3AD",
          hover: "#008994",
          light: "#E6F7F8",
          soft: "#F0FBFC",
          muted: "#7CC4CA",
        },
      },
      boxShadow: {
        soft:
          "0 4px 24px -6px rgba(30, 41, 59, 0.07), 0 2px 12px -4px rgba(30, 41, 59, 0.04)",
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 40px -14px rgba(15, 23, 42, 0.08)",
        program:
          "0 2px 8px -2px rgba(15, 23, 42, 0.06), 0 16px 40px -20px rgba(15, 23, 42, 0.14)",
        "program-hover":
          "0 4px 20px -4px rgba(0, 163, 173, 0.2), 0 20px 48px -24px rgba(15, 23, 42, 0.12)",
        megamenu:
          "0 24px 48px -12px rgba(15, 23, 42, 0.18), 0 12px 24px -8px rgba(15, 23, 42, 0.08)",
      },
      borderRadius: {
        "3xl": "1.25rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
