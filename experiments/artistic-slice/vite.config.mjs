import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  resolve: { dedupe: ['react', 'react-dom'] },
  oxc: { jsx: { runtime: 'automatic' } },
  build: { license: { fileName: 'THIRD-PARTY-NOTICES.md' } },
})
