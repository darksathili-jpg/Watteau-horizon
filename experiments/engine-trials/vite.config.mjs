import { copyFile } from 'node:fs/promises'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: { license: { fileName: 'THIRD-PARTY-NOTICES.md' } },
  plugins: [{
    name: 'watteau-embedded-license-notices',
    async closeBundle() {
      await copyFile(
        new URL('../../public/EMBEDDED-NOTICES.txt', import.meta.url),
        new URL('./dist/EMBEDDED-NOTICES.txt', import.meta.url),
      )
    },
  }],
})
