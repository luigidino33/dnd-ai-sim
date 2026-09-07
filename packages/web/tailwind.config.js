/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        parchment: "#f5ecd9",
        ink: "#1c1410",
        ember: "#c1440e",
        arcane: "#4b2e83",
      },
    },
  },
  plugins: [],
};
