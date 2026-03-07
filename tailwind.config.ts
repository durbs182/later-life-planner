import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Warm cream app background
        cream: {
          50:  '#fefcf8',
          100: '#fdf8f0',
          200: '#faf1e1',
        },
        // Life stage colours
        stage: {
          active:  '#f97316',   // Orange — energy, activity
          gradual: '#10b981',   // Emerald — balance, growth
          later:   '#8b5cf6',   // Violet — calm, wisdom
        },
        // Lifestyle level colours
        lifestyle: {
          minimum:     '#64748b',  // Slate
          moderate:    '#0ea5e9',  // Sky
          comfortable: '#10b981',  // Emerald
          beyond:      '#f97316',  // Orange
        },
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        'game':    '0 4px 24px -4px rgba(0,0,0,0.08), 0 1px 4px -1px rgba(0,0,0,0.04)',
        'game-lg': '0 8px 40px -8px rgba(0,0,0,0.12), 0 2px 8px -2px rgba(0,0,0,0.06)',
        'inner-soft': 'inset 0 2px 8px rgba(0,0,0,0.06)',
      },
      backgroundImage: {
        'gradient-active':  'linear-gradient(135deg, #f97316, #fb923c)',
        'gradient-gradual': 'linear-gradient(135deg, #10b981, #34d399)',
        'gradient-later':   'linear-gradient(135deg, #8b5cf6, #a78bfa)',
        'gradient-hero':    'linear-gradient(135deg, #f97316 0%, #fb923c 40%, #fbbf24 100%)',
        'gradient-income':  'linear-gradient(135deg, #0ea5e9, #38bdf8)',
        'gradient-assets':  'linear-gradient(135deg, #10b981, #34d399)',
      },
    },
  },
  plugins: [],
};

export default config;
