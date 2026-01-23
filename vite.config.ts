import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tsConfigPaths from 'vite-tsconfig-paths'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const cloudflareEnv = process.env.CLOUDFLARE_ENV || 'preview'
  const isProduction = cloudflareEnv === 'production'

  return {
    define: {
      __APP_ENV__: JSON.stringify(cloudflareEnv),
    },
    plugins: [
      // Cloudflare plugin MUST be first
      cloudflare({
        viteEnvironment: { name: 'ssr' },
        configPath: './wrangler.jsonc',
        environment: cloudflareEnv,
      }),
      tsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
      tanstackStart({
        srcDirectory: 'src',
        start: { entry: './start.tsx' },
        server: { entry: './server.ts' },
      }),
      tailwindcss(),
      viteReact(),
    ],
    // SSR config for @convex-dev/better-auth
    ssr: {
      noExternal: ['@convex-dev/better-auth'],
    },
    server: {
      port: 3000,
    },
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction,
          pure_funcs: isProduction ? ['console.log', 'console.info', 'console.debug'] : [],
        },
        format: {
          comments: false,
        },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'tanstack-vendor': ['@tanstack/react-router', '@tanstack/react-query'],
            'convex-vendor': ['convex/react'],
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
  }
})
