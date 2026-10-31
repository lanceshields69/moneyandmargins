import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// DATA_VERIFIED and SHARES_VERIFIED are build-time switches that default to true: the verified view is the default,
// and a flag is off only when its environment variable is exactly "false". VERCEL_ENV is read only to show the
// Preview badge. Nothing at runtime can change any of them.
export default defineConfig({
  plugins: [react()],
  define: {
    __DATA_VERIFIED__: JSON.stringify(process.env.DATA_VERIFIED !== 'false'),
    __SHARES_VERIFIED__: JSON.stringify(process.env.SHARES_VERIFIED !== 'false'),
    __VERCEL_ENV__: JSON.stringify(process.env.VERCEL_ENV ?? ''),
  },
  test: {
    environment: 'jsdom',
  },
})
