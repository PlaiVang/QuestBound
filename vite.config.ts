import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version
const revision = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
const dirty = Boolean(execSync('git status --porcelain', { encoding: 'utf8' }).trim())

// `npm run phone` serves over HTTPS on your local network so you can test
// GPS run tracking from a phone browser (browsers block GPS on plain http).
export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_REVISION__: JSON.stringify(revision + (dirty ? '-dirty' : '')),
  },
  plugins: mode === 'phone' ? [react(), basicSsl()] : [react()],
  server: mode === 'phone' ? { host: true } : undefined,
}))
