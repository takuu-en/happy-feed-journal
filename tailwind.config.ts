import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        cream: "#fffaf3",
      },
    },
  },
  plugins: [],
} satisfies Config;
