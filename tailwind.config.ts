import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Source Sans 3", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-sans)", "Source Sans 3", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["var(--font-sans)", "Source Sans 3", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#0f172a",
        soft: "#f8fafc",
        line: "#e2e8f0",
        moss: {
          DEFAULT: "#0f766e",
          50: "#f0fdfa",
          100: "#ccfbf1",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
          950: "#042f2e",
        },
      },
      borderRadius: {
        atlas: "8px",
      },
      transitionDuration: {
        atlas: "150ms",
      },
      boxShadow: {
        atlas: "0 1px 2px rgba(15, 23, 42, 0.06)",
      },
    },
  },
  plugins: [],
} satisfies Config;
