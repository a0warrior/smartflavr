/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '33%': { transform: 'translateY(-24px) translateX(12px)' },
          '66%': { transform: 'translateY(-12px) translateX(-8px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '33%': { transform: 'translateY(16px) translateX(-14px)' },
          '66%': { transform: 'translateY(-10px) translateX(10px)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'bell-ring': {
          '0%':   { transform: 'rotate(0deg)' },
          '10%':  { transform: 'rotate(14deg)' },
          '20%':  { transform: 'rotate(-12deg)' },
          '30%':  { transform: 'rotate(10deg)' },
          '40%':  { transform: 'rotate(-8deg)' },
          '50%':  { transform: 'rotate(5deg)' },
          '60%':  { transform: 'rotate(-3deg)' },
          '70%':  { transform: 'rotate(2deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
      },
      animation: {
        float: 'float 8s ease-in-out infinite',
        'float-slow': 'float-slow 12s ease-in-out infinite',
        'fade-up': 'fade-up 0.5s ease-out forwards',
        'gradient-shift': 'gradient-shift 10s ease infinite',
        'bell-ring': 'bell-ring 0.7s ease-out',
      },
    },
  },
  plugins: [],
}
