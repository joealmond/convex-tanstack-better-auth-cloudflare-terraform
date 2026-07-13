import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths({
      projects: ['./tsconfig.json'],
    }),
  ],
  test: {
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}', 'convex/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.convex'],
    // Silent by default - no noisy errors
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      // Unit coverage gates deterministic server and shared-library logic.
      // Browser routes and third-party redirects are covered by Playwright.
      include: ['convex/**/*.ts', 'src/lib/security-headers.ts', 'src/components/NotFound.tsx'],
      exclude: [
        '**/*.test.{ts,tsx}',
        'convex/_generated/**',
        'convex/convex.config.ts',
        'convex/crons.ts',
        'convex/test.utils.ts',
      ],
      thresholds: {
        lines: 65,
        functions: 65,
        statements: 65,
        branches: 50,
      },
    },
  },
})
