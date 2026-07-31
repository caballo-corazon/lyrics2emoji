// Script puntual: vuelca la cache local (data/translations.json) a DynamoDB
// y sube los .lrc ya guardados (data/lrc/) al bucket S3 — se ejecuta una sola vez
// tras crear la infraestructura, para no perder lo ya cacheado/las canciones ya subidas.
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { setCached } from '../server-lib/cache.js'
import { writeLrc } from '../server-lib/lrcStorage.js'

const CACHE_PATH = './data/translations.json'
const LRC_DIR = './data/lrc'

async function migrateCache() {
  const cache = JSON.parse(readFileSync(CACHE_PATH, 'utf-8'))
  const entries = Object.entries(cache)
  console.log(`[cache] migrando ${entries.length} traducciones...`)

  let i = 0
  for (const [phrase, emojis] of entries) {
    await setCached(phrase, emojis)
    i++
    if (i % 50 === 0) console.log(`[cache] ${i}/${entries.length}`)
  }
  console.log(`[cache] listo: ${entries.length} traducciones migradas`)
}

async function migrateLrc() {
  const files = readdirSync(LRC_DIR).filter((f) => f.endsWith('.lrc'))
  console.log(`[lrc] migrando ${files.length} archivos...`)

  for (const file of files) {
    const content = readFileSync(join(LRC_DIR, file), 'utf-8')
    await writeLrc(file, content)
    console.log(`[lrc] subido: ${file}`)
  }
  console.log(`[lrc] listo: ${files.length} archivos subidos`)
}

await migrateCache()
await migrateLrc()
