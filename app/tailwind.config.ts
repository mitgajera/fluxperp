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
        // cool near-black surfaces, layered for depth
        surface: {
          0: "#0a0b0d",
          1: "#0f1115",
          2: "#15171c",
          3: "#1d2027",
        },
        line: "#23262e",
        "line-strong": "#313540",
        // text hierarchy
        txt: "#e8eaed",
        muted: "#8b909c",
        faint: "#585d68",
        // semantic — reserved for price / PnL / side only
        long: "#2ebd85", // refined emerald (was neon #39ff14)
        "long-dim": "#1f9468",
        short: "#f6465d", // clean red
        "short-dim": "#c43a4c",
        up: "#2ebd85", // candle bullish (matches long)
        down: "#f6465d", // candle bearish (matches short)
        accent: "#2ebd85",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }], // 11px dense tables
      },
      boxShadow: {
        // subtle, not neon halos (UI skill: minimal glow)
        glow: "0 0 14px rgba(46,189,133,0.16)",
        "glow-sm": "0 0 8px rgba(46,189,133,0.10)",
        "panel-hi": "inset 0 1px 0 0 rgba(255,255,255,0.03)",
      },
      keyframes: {
        "flash-up": {
          "0%": { backgroundColor: "rgba(46,189,133,0.16)" },
          "100%": { backgroundColor: "transparent" },
        },
        "flash-down": {
          "0%": { backgroundColor: "rgba(246,70,93,0.16)" },
          "100%": { backgroundColor: "transparent" },
        },
        "row-in": {
          "0%": { opacity: "0", transform: "translateY(-6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "toast-in": {
          "0%": { opacity: "0", transform: "translateX(12px) scale(0.97)" },
          "100%": { opacity: "1", transform: "translateX(0) scale(1)" },
        },
        "toast-bar": {
          "0%": { transform: "scaleX(1)" },
          "100%": { transform: "scaleX(0)" },
        },
        "pulse-dot": {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "flash-up": "flash-up 0.5s ease-out",
        "flash-down": "flash-down 0.5s ease-out",
        "row-in": "row-in 0.22s ease-out",
        "toast-in": "toast-in 0.28s cubic-bezier(0.16,1,0.3,1)",
        "toast-bar": "toast-bar linear forwards",
        "pulse-dot": "pulse-dot 1.6s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
