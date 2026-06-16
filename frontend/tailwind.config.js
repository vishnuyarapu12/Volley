/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'volleyball': {
          'dark': '#0f172a',
          'darker': '#06092b',
          'accent': '#fbbf24',
          'success': '#10b981',
          'warning': '#f59e0b',
          'danger': '#ef4444',
          'info': '#3b82f6',
        }
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'float': 'floatAnim 3s ease-in-out infinite',
        'fadeIn': 'fadeInAnim 0.35s ease-out both',
        'cardReveal': 'cardReveal 0.4s cubic-bezier(0.34,1.4,0.64,1) forwards',
        'lightboxIn': 'lightboxIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      }
    },
  },
  plugins: [],
  darkMode: 'class',
}
