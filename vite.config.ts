import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `npm run phone` serves over HTTPS on your local network so you can test
// GPS run tracking from a phone browser (browsers block GPS on plain http).
export default defineConfig(({ mode }) => ({
  plugins: mode === 'phone' ? [react(), basicSsl()] : [react()],
  server: mode === 'phone' ? { host: true } : undefined,
}))
