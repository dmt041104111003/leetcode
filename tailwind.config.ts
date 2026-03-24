import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-be-vietnam-pro)", "sans-serif"],
        lexend: ["var(--font-lexend)", "sans-serif"],
      },
      colors: {
        primary: {
          red: "#ea2035",
          'red-dark': "#ee2c2c",
        },
        hero: {
          light: {
            icon: "#ea2035",
            iconHover: "#ee2c2c",
            text: "#111827",
            textSecondary: "#1f2937",
            inputBg: "#ffffff",
            inputBorder: "#ea2035",
            inputBorderFocus: "#ee2c2c",
            buttonBg: "#ea2035",
            buttonHover: "#ee2c2c",
            cardBg: "rgba(255, 255, 255, 0.95)",
            cardHover: "#ffffff",
            overlay: "rgba(0, 0, 0, 0.1)",
          },
          dark: {
            icon: "#ea2035",
            iconHover: "#ee2c2c",
            text: "#ffffff",
            textSecondary: "#f3f4f6",
            inputBg: "#1f2937",
            inputBorder: "#ea2035",
            inputBorderFocus: "#ee2c2c",
            buttonBg: "#ea2035",
            buttonHover: "#ee2c2c",
            cardBg: "rgba(31, 41, 55, 0.95)",
            cardHover: "#1f2937",
            overlay: "rgba(0, 0, 0, 0.5)",
          },
        },
      },
    },
  },
  plugins: [],
};
export default config;
