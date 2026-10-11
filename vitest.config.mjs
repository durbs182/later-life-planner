import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Exclude the legacy node:test file, Playwright e2e specs, and standalone boundary suite
const exclude = ['tests/financialEngine.test.ts', 'tests/e2e/**', 'tests/boundaries/**', 'node_modules/**'];

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    setupFiles: ['./tests/ui/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text-summary'],
      include: ['src/**'],
    },
    projects: [
      {
        extends: true,
        test: { name: 'node', environment: 'node', exclude: [...exclude, 'tests/ui/**'] },
      },
      {
        extends: true,
        test: { name: 'ui', environment: 'jsdom', include: ['tests/ui/**/*.test.{ts,tsx}'], exclude },
      },
    ],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
