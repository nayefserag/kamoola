/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background:    '#080810',
        surface:       '#10101e',
        'surface-2':   '#1a1a2e',
        accent:        '#e63946',
        textPrimary:   '#f0f0f8',
        textSecondary: '#7a7a9a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow':    '0 0 24px rgba(230,57,70,0.45)',
        'glow-sm': '0 0 12px rgba(230,57,70,0.28)',
        'card':    '0 8px 32px rgba(0,0,0,0.6)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
