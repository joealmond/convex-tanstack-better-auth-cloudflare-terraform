import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

export default defineConfig(({ mode }) => ({
  define: {
    __APP_ENV__: JSON.stringify(mode === 'production' ? 'production' : 'development'),
  },
  plugins: [
    tsConfigPaths({ projects: ['./tsconfig.json'] }),
    tanstackStart({
      srcDirectory: 'src',
      start: { entry: './start.tsx' },
      server: { entry: './server.ts' },
    }),
    nitro(),
    tailwindcss(),
    viteReact(),
  ],
  ssr: { noExternal: ['@convex-dev/better-auth'] },
  server: { port: 3000 },
  build: { minify: 'terser', chunkSizeWarningLimit: 600 },
}))
