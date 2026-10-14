import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // three.js is one large module by nature; keep it in its own cacheable chunk.
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }],
        },
      },
    },
  },
})
