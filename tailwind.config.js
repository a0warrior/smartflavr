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
        'heart-pop': {
          '0%':   { transform: 'scale(1)' },
          '30%':  { transform: 'scale(1.45)' },
          '60%':  { transform: 'scale(0.88)' },
          '80%':  { transform: 'scale(1.12)' },
          '100%': { transform: 'scale(1)' },
        },
        'bubble-pop': {
          '0%':   { transform: 'scale(1)' },
          '40%':  { transform: 'scale(0.82)' },
          '70%':  { transform: 'scale(1.12)' },
          '100%': { transform: 'scale(1)' },
        },
        'pop-in': {
          '0%':   { opacity: '0', transform: 'scale(0.5)' },
          '60%':  { opacity: '1', transform: 'scale(1.06)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'check-draw': {
          '0%':   { strokeDashoffset: '24' },
          '100%': { strokeDashoffset: '0' },
        },
      },
      animation: {
        float: 'float 8s ease-in-out infinite',
        'float-slow': 'float-slow 12s ease-in-out infinite',
        'fade-up': 'fade-up 0.5s ease-out forwards',
        'gradient-shift': 'gradient-shift 10s ease infinite',
        'bell-ring': 'bell-ring 0.7s ease-out',
        'heart-pop': 'heart-pop 0.35s cubic-bezier(.36,.07,.19,.97)',
        'bubble-pop': 'bubble-pop 0.3s ease-out',
        'pop-in': 'pop-in 0.45s cubic-bezier(.34,1.4,.64,1) forwards',
        'check-draw': 'check-draw 0.4s ease-out 0.2s forwards',
      },
    },
  },
  plugins: [],
}
