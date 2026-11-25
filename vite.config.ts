import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  build: { license: { fileName: 'THIRD-PARTY-NOTICES.md' } },
  test: { include: ['src/**/*.test.ts'] },
})
