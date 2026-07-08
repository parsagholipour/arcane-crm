import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d8ebff",
          500: "#0176d3",
          600: "#0b5cab",
          700: "#014486",
          900: "#032d60"
        },
        shell: "#032d60",
        canvas: "#f3f3f3"
      },
      boxShadow: {
        modal: "0 12px 36px rgba(0, 0, 0, 0.22)",
        popover: "0 8px 24px rgba(0, 0, 0, 0.18)"
      }
    }
  },
  plugins: []
};

export default config;
