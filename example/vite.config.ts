import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0', // 允许外部访问，方便 ngrok 等工具使用
    // 允许所有 host（用于内网穿透工具如 ngrok、serveo、localtunnel 等）
    allowedHosts: [
      'localhost',
      '.loca.lt',        // localtunnel
      '.serveo.net',     // serveo
      '.ngrok.io',       // ngrok
      '.enclave-hq.com', // ngrok free tier
      '.trycloudflare.com', // cloudflare tunnel
    ],
    // 或者允许所有 host（开发环境推荐）
    // allowedHosts: 'all',
  },
  define: {
    global: 'globalThis',
  },
})


