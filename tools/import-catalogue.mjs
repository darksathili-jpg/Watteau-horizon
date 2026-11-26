import { randomUUID } from 'node:crypto'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { importCatalogue } from '../src/data/import-catalogue.ts'

const snapshot = new URL('../data/parcoursup/cartographie-2026-valenciennois.json', import.meta.url)
const manifestPath = new URL('../data/parcoursup/manifest.json', import.meta.url)
const target = new URL('../src/data/catalogue.ts', import.meta.url)

async function main(args) {
  const check = args.length === 1 && args[0] === '--check'
  if (args.length && !check) throw new Error('Usage : import-catalogue.mjs [--check]')

  const [raw, manifestText] = await Promise.all([readFile(snapshot), readFile(manifestPath, 'utf8')])
  const { catalogue, quarantine, missingFormationCodes } = importCatalogue(raw, JSON.parse(manifestText))
  if (quarantine.length || missingFormationCodes.length) {
    console.error(JSON.stringify({ quarantine, missingFormationCodes }, null, 2))
    throw new Error('Import Parcoursup interrompu. Réviser les anomalies de l’extrait.')
  }

  const generated = [
    '// Généré par tools/import-catalogue.mjs à partir de l’extrait archivé.',
    "import type { Catalogue } from './catalogue-types'",
    '',
    'export const catalogue: Catalogue = ' + JSON.stringify(catalogue, null, 2),
    '',
  ].join('\n')

  if (check) {
    const current = await readFile(target, 'utf8')
    if (current.replaceAll('\r\n', '\n') !== generated) {
      throw new Error('Catalogue généré obsolète. Relancer l’import avant de compiler.')
    }
  } else {
    const temporary = new URL(`catalogue.${randomUUID()}.tmp`, target)
    try {
      await writeFile(temporary, generated, { flag: 'wx' })
      await rename(temporary, target)
    } finally {
      await rm(temporary, { force: true })
    }
  }

  console.log(JSON.stringify({ coverage: catalogue.coverage, quarantine, missingFormationCodes }, null, 2))
}

try {
  await main(process.argv.slice(2))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
