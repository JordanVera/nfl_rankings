/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF5F1F',
          50: '#fff3eb',
          100: '#ffe4d1',
          200: '#ffc9a3',
          300: '#ffae75',
          400: '#ff9347',
          500: '#FF5F1F',
          600: '#cc4c19',
          700: '#993913',
          800: '#66260c',
          900: '#331306',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
