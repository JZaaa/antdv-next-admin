/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      // Keep the existing application tokens; Antd token plugins can redefine bare utility names.
      colors: {
        primary: 'var(--color-primary)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'bg-container': 'var(--color-bg-container)',
        'bg-layout': 'var(--color-bg-layout)',
        border: 'var(--color-border)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        info: 'var(--color-info)',
      },
      // Tailwind 4 uses currentColor for bare borders and a 1px currentColor ring.
      borderColor: { DEFAULT: 'currentColor' },
      ringColor: { DEFAULT: 'currentColor' },
      ringWidth: { DEFAULT: '1px' },
      borderRadius: {
        xs: '0.125rem',
        sm: 'var(--radius-sm)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '4xl': '2rem',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
      },
    },
  },
};
