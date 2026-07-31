import { translateWithBedrock } from './bedrock.js'
import { getCached, setCached } from './cache.js'
import { listSavedLrc, readLrc, writeLrc } from './lrcStorage.js'
import { searchLrclib, importLrclibTrack } from './lrclib.js'

function runWithConcurrency(items, limit, worker) {
  if (items.length === 0) return Promise.resolve()

  return new Promise((resolveAll) => {
    let next = 0
    let active = 0

    function launch() {
      if (next >= items.length) { if (active === 0) resolveAll(); return }
      const i = next++
      active++
      worker(items[i]).then(() => {
        active--
        launch()
      })
    }

    for (let i = 0; i < Math.min(limit, items.length); i++) launch()
  })
}

export async function translate(text) {
  if (!text) throw new Error('Missing text')

  const key = text.toLowerCase().trim()
  const cached = await getCached(key)
  if (cached) {
    console.log(`[cache] hit: "${text}" → ${cached}`)
    return { emojis: cached, cached: true }
  }

  const emojis = await translateWithBedrock(text)
  await setCached(key, emojis)
  return { emojis }
}

export async function translateBatch(lines) {
  if (!Array.isArray(lines)) throw new Error('Missing lines[]')

  const uniqueTexts = [...new Set(lines.map((t) => t.trim()).filter(Boolean))]
  console.log(`[batch] ${uniqueTexts.length} frases únicas`)

  const translations = {}
  await runWithConcurrency(uniqueTexts, 4, async (text) => {
    const key = text.toLowerCase().trim()
    const cached = await getCached(key)
    if (cached) {
      translations[key] = cached
      return
    }
    const emojis = await translateWithBedrock(text)
    await setCached(key, emojis)
    translations[key] = emojis
  })

  return { translations }
}

export async function lrcList() {
  return { files: await listSavedLrc() }
}

// devuelve null si no existe — el llamador decide cómo responder (404)
export async function lrcFileGet(name) {
  return await readLrc(name)
}

export async function lrcFileSave(name, content) {
  const safeName = await writeLrc(name, content)
  console.log(`[lrc] guardado: ${safeName}`)
  return { name: safeName }
}

export async function lrclibSearch(track, artist) {
  return { results: await searchLrclib(track, artist) }
}

export async function lrclibImport(id) {
  if (!id) throw new Error('Falta el id de la pista')
  return await importLrclibTrack(id)
}
