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
          DEFAULT: '#163172',  // dark navy — headers, primary buttons
          mid: '#1E56A0',      // medium blue — active states, links
          light: '#3A72B8',    // light navy — subtle accents
        },
        cyan: {
          DEFAULT: '#D6E4F0',  // light blue — accent on dark backgrounds
          light: '#EBF2F9',    // softer light blue — chip backgrounds
          dark: '#1E56A0',     // medium blue — darker accent
        },
        'app-bg': '#F6F6F6',   // screen background
      },
    },
  },
  plugins: [],
};
