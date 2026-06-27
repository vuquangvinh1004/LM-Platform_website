import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0f766e",
        secondary: "#0369a1",
        neutral: "#f8fafc",
        "on-primary": "#f8fafc",
        "on-neutral": "#0f172a",
        error: "#b91c1c",
        success: "#166534",
      },
      fontFamily: {
        h1: ["Be Vietnam Pro"],
        "body-md": ["Be Vietnam Pro"],
        "label-sm": ["Be Vietnam Pro"],
      },
      fontSize: {
        h1: ["2rem", { fontWeight: "700" }],
        "body-md": ["1rem", { fontWeight: "400" }],
        "label-sm": ["0.875rem", { fontWeight: "500" }],
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
      },
      spacing: {
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
      },
    },
  },
  plugins: [],
};

export default config;
