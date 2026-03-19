import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        status: {
          passed: 'hsl(var(--status-passed))',
          failed: 'hsl(var(--status-failed))',
          error: 'hsl(var(--status-error))',
          warning: 'hsl(var(--status-warning))',
          running: 'hsl(var(--status-running))',
          pending: 'hsl(var(--status-pending))',
        },
        priority: {
          'low-bg': 'hsl(var(--priority-low-bg))',
          'low-fg': 'hsl(var(--priority-low-fg))',
          'medium-bg': 'hsl(var(--priority-medium-bg))',
          'medium-fg': 'hsl(var(--priority-medium-fg))',
          'high-bg': 'hsl(var(--priority-high-bg))',
          'high-fg': 'hsl(var(--priority-high-fg))',
          'critical-bg': 'hsl(var(--priority-critical-bg))',
          'critical-fg': 'hsl(var(--priority-critical-fg))',
        },
        code: {
          bg: 'hsl(var(--code-bg))',
          fg: 'hsl(var(--code-fg))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [typography],
};

export default config;
