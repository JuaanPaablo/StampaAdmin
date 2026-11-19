import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#001D3D', 2: '#0F2A4A', 3: '#013565' },
        sun: { DEFAULT: '#FFC301', 2: '#FFD60C' },
        ink: '#010713',
        surface: '#F3F6FA',
        line: '#E1E8F0',
        muted: '#4A6380',
        good: '#1E9E64',
        bad: '#C7372F'
      },
      fontFamily: {
        display: ['Sora', 'Segoe UI', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'Consolas', 'monospace']
      },
      boxShadow: { card: '0 6px 18px rgba(0,29,61,.07)' }
    }
  },
  plugins: []
};
export default config;
