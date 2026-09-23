import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(() => {
  const cloudflareEnv = process.env.CLOUDFLARE_ENV || 'preview'
  const isProduction = cloudflareEnv === 'production'

  return {
    define: {
      __APP_ENV__: JSON.stringify(cloudflareEnv),
    },
    resolve: { tsconfigPaths: true },
    plugins: [
      // Cloudflare plugin MUST be first
      cloudflare({
        viteEnvironment: { name: 'ssr' },
        configPath: './wrangler.jsonc',
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
      minify: 'terser' as const,
      terserOptions: {
        compress: {
          drop_debugger: isProduction,
          pure_funcs: isProduction ? ['console.log', 'console.info', 'console.debug'] : [],
        },
        format: {
          comments: false,
        },
      },
      chunkSizeWarningLimit: 600,
    },
  }
})
