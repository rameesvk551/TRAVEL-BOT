/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f8f9fa',
          100: '#f1f3f5',
          200: '#e0e4e8',
          300: '#bac4d0',
          400: '#8b9bb0',
          500: '#647893',
          600: '#465873',
          700: '#2d3b51',
          800: '#1a2435',
          900: '#0d1b3e',
          950: '#0a1628',
        },
        surface: {
          50: '#f8f9fa',
          100: '#f1f3f5',
          200: '#e0e4e8',
          300: '#bac4d0',
          400: '#8b9bb0',
          500: '#647893',
          600: '#465873',
          700: '#2d3b51',
          800: '#1a2435',
          900: '#0d1b3e',
          950: '#0a1628',
        },
        slate: {
          50: '#f8f9fa', 100: '#f1f3f5', 200: '#e0e4e8', 300: '#bac4d0', 400: '#8b9bb0', 500: '#647893', 600: '#465873', 700: '#2d3b51', 800: '#1a2435', 900: '#0d1b3e', 950: '#0a1628',
        },
        emerald: {
          50: '#f8f9fa', 100: '#f1f3f5', 200: '#e0e4e8', 300: '#bac4d0', 400: '#8b9bb0', 500: '#647893', 600: '#465873', 700: '#2d3b51', 800: '#1a2435', 900: '#0d1b3e', 950: '#0a1628',
        },
        sky: {
          50: '#f8f9fa', 100: '#f1f3f5', 200: '#e0e4e8', 300: '#bac4d0', 400: '#8b9bb0', 500: '#647893', 600: '#465873', 700: '#2d3b51', 800: '#1a2435', 900: '#0d1b3e', 950: '#0a1628',
        },
        amber: {
          50: '#f8f9fa', 100: '#f1f3f5', 200: '#e0e4e8', 300: '#bac4d0', 400: '#8b9bb0', 500: '#647893', 600: '#465873', 700: '#2d3b51', 800: '#1a2435', 900: '#0d1b3e', 950: '#0a1628',
        },
        indigo: {
          50: '#f8f9fa', 100: '#f1f3f5', 200: '#e0e4e8', 300: '#bac4d0', 400: '#8b9bb0', 500: '#647893', 600: '#465873', 700: '#2d3b51', 800: '#1a2435', 900: '#0d1b3e', 950: '#0a1628',
        },
        rose: {
          50: '#f8f9fa', 100: '#f1f3f5', 200: '#e0e4e8', 300: '#bac4d0', 400: '#8b9bb0', 500: '#647893', 600: '#465873', 700: '#2d3b51', 800: '#1a2435', 900: '#0d1b3e', 950: '#0a1628',
        },
        whatsapp: {
          light: '#f1f3f5',
          dark: '#0a1628',
          teal: '#0d1b3e',
          blue: '#0d1b3e',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Manrope', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
};
