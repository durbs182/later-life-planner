import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, '../../src') },
  },
  test: {
    globals: true,
    setupFiles: [path.resolve(__dirname, '../ui/setup.ts')],
    projects: [
      {
        extends: true,
        test: {
          name: 'boundaries',
          environment: 'node',
          include: ['tests/boundaries/**/*.test.{ts,tsx}'],
          exclude: ['tests/boundaries/ui/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'boundaries-ui',
          environment: 'jsdom',
          include: ['tests/boundaries/ui/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
});
