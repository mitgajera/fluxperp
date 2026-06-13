import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // OLED dark surfaces (SPECS §7 near-black base)
        surface: {
          0: "#0a0a0a",
          1: "#0e0e10",
          2: "#131316",
          3: "#18181b",
        },
        line: "#1c1c20",
        "line-strong": "#2a2a30",
        // semantic
        txt: "#ededed",
        muted: "#8a8a8a",
        faint: "#5a5a5a",
        long: "#39ff14", // neon green accent — long / bid / profit
        "long-dim": "#2bbf4e",
        short: "#ff4d4d", // red — short / ask / loss
        "short-dim": "#cf3a3a",
        up: "#26a69a", // candle bullish
        down: "#ef5350", // candle bearish
        accent: "#39ff14",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }], // 11px dense tables
      },
      boxShadow: {
        glow: "0 0 12px rgba(57,255,20,0.35)",
        "glow-sm": "0 0 6px rgba(57,255,20,0.25)",
      },
      keyframes: {
        "flash-up": {
          "0%": { backgroundColor: "rgba(57,255,20,0.18)" },
          "100%": { backgroundColor: "transparent" },
        },
        "flash-down": {
          "0%": { backgroundColor: "rgba(255,77,77,0.18)" },
          "100%": { backgroundColor: "transparent" },
        },
        "row-in": {
          "0%": { opacity: "0", transform: "translateY(-6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "toast-in": {
          "0%": { opacity: "0", transform: "translateY(8px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "pulse-dot": {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "flash-up": "flash-up 0.5s ease-out",
        "flash-down": "flash-down 0.5s ease-out",
        "row-in": "row-in 0.22s ease-out",
        "toast-in": "toast-in 0.22s ease-out",
        "pulse-dot": "pulse-dot 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
