/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef7ff',
          100: '#d9edff',
          200: '#b7dbff',
          300: '#89c2ff',
          400: '#4fa3ff',
          500: '#1a85ff',
          600: '#0f6ce0',
          700: '#0c55b3',
          800: '#0b4794',
          900: '#0d3b79'
        }
      }
    },
  },
  plugins: [],
};
