/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'blaze-black': '#020617', // Slate-950
        'blaze-red': '#e11d48',   // Rose-600
        'blaze-green': '#10b981', // Emerald-500
        'blaze-white': '#ffffff', // White
      }
    },
  },
  plugins: [],
}
