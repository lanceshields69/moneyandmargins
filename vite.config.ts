import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// DATA_VERIFIED and SHARES_VERIFIED are build-time environment variables, false unless set to "true".
// Vercel sets them for Preview only. Nothing at runtime can change them.
export default defineConfig({
  plugins: [react()],
  define: {
    __DATA_VERIFIED__: JSON.stringify(process.env.DATA_VERIFIED === 'true'),
    __SHARES_VERIFIED__: JSON.stringify(process.env.SHARES_VERIFIED === 'true'),
  },
  test: {
    environment: 'jsdom',
  },
})
