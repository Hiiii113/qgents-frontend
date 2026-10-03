import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      host: true,
      port: 5173,
      allowedHosts: env.DEV_ALLOWED_HOSTS?.split(',').map(host => host.trim()).filter(Boolean),
      proxy: env.VITE_USE_MOCK === 'true' ? undefined : {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://localhost:8080',
          changeOrigin: true,
          ws: true,
          timeout: 60_000,
          proxyTimeout: 60_000,
          rewrite: path => path.replace(/^\/api(?=\/|$)/, '/api/v1'),
        },
      },
    },
  }
})
