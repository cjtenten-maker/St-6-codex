import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0c0f0d",
        panel: "#151a17",
        panel2: "#1d2622",
        line: "#31403a",
        paper: "#e8e2d4",
        mute: "#9aa396",
        brass: "#e0a45a",
        brass2: "#8a6232",
        hp: "#e06a5c",
        mana: "#6cb6c4",
        good: "#8fbf7a",
        miss: "#8d877c",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["Outfit", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(224,164,90,0.12), 0 12px 40px rgba(0,0,0,0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
