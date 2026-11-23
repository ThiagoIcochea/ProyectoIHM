import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' para que funcione en GitHub Pages (subcarpeta /ProyectoIHM/) y en cualquier hosting estático.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true },
  build: { chunkSizeWarningLimit: 1600 }
})
