import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const fromRoot = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fromRoot('./src'),
      'server-only': fromRoot('./tests/stubs/server-only.ts'),
    },
  },
  test: {
    // Las pruebas de servidor declaran `// @vitest-environment node` en su archivo.
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'src/**/*.test.{ts,tsx}',
      'scripts/**/*.test.{ts,mts}',
      'tests/**/*.test.ts',
    ],
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
    css: false,
    restoreMocks: true,
  },
});
