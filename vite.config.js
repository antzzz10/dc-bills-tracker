import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use '/' for custom domain (representdc.org)
  // Use '/dc-bills-tracker/' for GitHub Pages without custom domain
  base: '/',
})
