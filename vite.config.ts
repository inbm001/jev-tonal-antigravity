import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/typesafe-api': {
        target: 'https://api.typesafe.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/typesafe-api/, ''),
      },
    },
  },
})
