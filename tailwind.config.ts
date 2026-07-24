import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Source Sans 3", "system-ui", "sans-serif"]
      },
      colors: {
        brand: {
          50: "#f0f1ff",
          100: "#e0e2ff",
          200: "#c7c9ff",
          300: "#a5a8ff",
          400: "#8385fa",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#1e1b4b"
        },
        accent: {
          50: "#effefb",
          100: "#ccfbf1",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488"
        },
        shell: "#17163f",
        canvas: "#f2f4f7"
      },
      borderRadius: {
        DEFAULT: "0.375rem"
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)",
        "card-hover": "0 4px 8px -2px rgba(16, 24, 40, 0.08), 0 2px 4px -2px rgba(16, 24, 40, 0.06)",
        popover:
          "0 0 0 1px rgba(3, 45, 96, 0.04), 0 4px 6px -2px rgba(16, 24, 40, 0.05), 0 12px 24px -4px rgba(16, 24, 40, 0.16)",
        modal:
          "0 0 0 1px rgba(3, 45, 96, 0.05), 0 8px 12px -4px rgba(3, 45, 96, 0.1), 0 24px 60px -12px rgba(3, 45, 96, 0.32)",
        header: "0 1px 2px rgba(3, 45, 96, 0.05), 0 2px 8px rgba(3, 45, 96, 0.04)"
      }
    }
  },
  plugins: []
};

export default config;
