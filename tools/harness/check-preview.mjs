import { readFile, readdir } from 'node:fs/promises'

const dist = new URL('../../dist/', import.meta.url)
const html = await readFile(new URL('index.html', dist), 'utf8')
const assets = new URL('assets/', dist)
const entries = (await readdir(assets)).filter((name) => /^index-.*\.js$/.test(name))
if (entries.length !== 1) throw new Error('Module client principal introuvable.')
const script = await readFile(new URL(entries[0], assets), 'utf8')
if (!html.includes('name="robots" content="noindex, nofollow"') || !script.includes('Prévisualisation de développement · Campus fictif')) {
  throw new Error('Le paquet ne porte pas le bandeau et les consignes de la prévisualisation.')
}
console.log('Bandeau de développement et consignes aux indexeurs vérifiés.')
