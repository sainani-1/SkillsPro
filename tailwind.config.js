/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          400: '#FFD700',
          500: '#C5A000',
          600: '#A48600',
        },
        nani: {
          dark: '#1a1a2e',
          card: '#16213e',
          accent: '#0f3460',
          light: '#e94560'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Merriweather', 'serif'],
      }
    },
  },
  plugins: [
    require('tailwind-scrollbar')
  ],
}