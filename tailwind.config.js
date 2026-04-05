/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: [
    "./App.tsx",
    "./screens/**/*.{js,jsx,ts,tsx}",
    "./navigation/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0E1C40',
          mid: '#1B3A6B',
          light: '#2A4F8A',
        },
        cyan: {
          DEFAULT: '#00C5FF',
          light: '#E8F8FF',
          dark: '#0099CC',
        },
      },
    },
  },
  plugins: [],
};
