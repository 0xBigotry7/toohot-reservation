module.exports = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'playfair': ['Playfair Display', 'serif'],
        'crimson': ['Crimson Text', 'serif'],
      },
      colors: {
        'sand-beige': '#DDD3C4',
        'hinoki-wood': '#BFA68A',
        'charcoal': '#3A3A3A',
        'ink-black': '#1B1B1B',
        'copper': '#B86F3A',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
}; 