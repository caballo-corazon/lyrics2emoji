import { createServer } from 'http'
import { readFileSync, writeFileSync, existsSync, createReadStream, mkdirSync, readdirSync, statSync } from 'fs'
import { join, extname, resolve, basename } from 'path'
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import { buildSystemPrompt, buildUserPrompt } from '../src/translator/prompt.js'

const PORT       = 3002
const PUBLIC     = resolve('./public')
const SRC        = resolve('./src')
const CACHE_PATH = './data/translations.json'
const PROMPT_FILE = './data/system-prompt.txt'
const LRC_DIR    = './data/lrc'

const AWS_REGION      = process.env.AWS_REGION ?? 'eu-west-1'
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'eu.amazon.nova-micro-v1:0'

const bedrock = new BedrockRuntimeClient({ region: AWS_REGION })

mkdirSync(LRC_DIR, { recursive: true })

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.css':  'text/css',
  '.png':  'image/png',
}

// — build enriched system prompt at startup —

function buildEmojiCatalog() {
  const data = JSON.parse(readFileSync('./public/data/openmoji.json', 'utf-8'))
  const SKIP = new Set(['component', 'flags'])

  const byGroup = {}
  for (const e of data) {
    if (e.unicode === '' || e.skintone !== '' || SKIP.has(e.group)) continue
    if (!byGroup[e.group]) byGroup[e.group] = []
    const tags = (e.tags || e.openmoji_tags || '').trim()
    byGroup[e.group].push(`  ${e.emoji} ${e.annotation}${tags ? ' — ' + tags : ''}`)
  }

  return Object.entries(byGroup)
    .map(([g, entries]) => `[${g}]\n${entries.join('\n')}`)
    .join('\n\n')
}

const catalog = buildEmojiCatalog()
const systemPrompt = buildSystemPrompt(catalog)
writeFileSync(PROMPT_FILE, systemPrompt)
console.log(`system prompt: ${(systemPrompt.length / 1024).toFixed(1)} KB — ${catalog.split('\n').filter(l => l.startsWith('  ')).length} emojis`)

// — translation —

const loadCache = () => existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, 'utf-8')) : {}
const saveCache = (c) => writeFileSync(CACHE_PATH, JSON.stringify(c, null, 2))

async function callModel(text) {
  const t0 = Date.now()
  console.log(`[bedrock] → "${text}"`)

  const res = await bedrock.send(new ConverseCommand({
    modelId: BEDROCK_MODEL_ID,
    system: [{ text: systemPrompt }],
    messages: [{ role: 'user', content: [{ text: buildUserPrompt(text) }] }],
    inferenceConfig: { maxTokens: 20 },
  }))

  const emojis = res.output.message.content[0].text.trim().split('\n')[0].trim()
  console.log(`[bedrock] ← "${text}" → ${emojis}  (${Date.now() - t0}ms)`)
  return emojis
}

// — traducción por lotes (para el modo LRC) —

function runWithConcurrency(items, limit, worker) {
  if (items.length === 0) return Promise.resolve([])

  return new Promise((resolveAll) => {
    const results = new Array(items.length)
    let next = 0
    let active = 0

    function launch() {
      if (next >= items.length) { if (active === 0) resolveAll(results); return }
      const i = next++
      active++
      worker(items[i], i).then((r) => {
        results[i] = r
        active--
        launch()
      })
    }

    for (let i = 0; i < Math.min(limit, items.length); i++) launch()
  })
}

async function translateBatch(lines) {
  const cache = loadCache()
  const uniqueTexts = [...new Set(lines.map((t) => t.trim()).filter(Boolean))]
  const pending = uniqueTexts.filter((t) => !cache[t.toLowerCase().trim()])

  await runWithConcurrency(pending, 4, async (text) => {
    const key = text.toLowerCase().trim()
    cache[key] = await callModel(text)
  })

  if (pending.length > 0) saveCache(cache)

  const translations = {}
  for (const text of uniqueTexts) translations[text.toLowerCase().trim()] = cache[text.toLowerCase().trim()]
  return translations
}

// — canciones LRC guardadas —

function sanitizeLrcName(name) {
  const raw = String(name || '').trim()
  if (!raw) throw new Error('Nombre de archivo inválido')
  // reemplaza separadores de ruta (no los usa como límite: "AC/DC" no debe truncarse a "DC")
  const noSlashes = raw.replace(/[\\/]+/g, '-')
  const safe = basename(noSlashes).replace(/[^\w.\- ]+/g, '_')
  if (!safe) throw new Error('Nombre de archivo inválido')
  return /\.lrc$/i.test(safe) ? safe : `${safe}.lrc`
}

function listSavedLrc() {
  return readdirSync(LRC_DIR)
    .filter((f) => f.endsWith('.lrc'))
    .map((f) => ({ name: f, mtime: statSync(join(LRC_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .map((f) => f.name)
}

// — importar canciones desde lrclib.net —

const LRCLIB_BASE = 'https://lrclib.net/api'
const LRCLIB_HEADERS = { 'User-Agent': 'lyrics2emoji (https://github.com) - personal project' }

async function fetchLrclibJson(url) {
  const res = await fetch(url, { headers: LRCLIB_HEADERS })
  if (!res.ok) throw new Error(`lrclib.net respondió ${res.status}`)
  return res.json()
}

async function searchLrclib(track, artist) {
  if (!track) throw new Error('Falta el nombre de la canción')
  const params = new URLSearchParams({ track_name: track })
  if (artist) params.set('artist_name', artist)

  const results = await fetchLrclibJson(`${LRCLIB_BASE}/search?${params}`)
  return results
    .filter((r) => r.syncedLyrics)
    .map((r) => ({
      id: r.id,
      trackName: r.trackName,
      artistName: r.artistName,
      albumName: r.albumName,
      duration: r.duration,
    }))
}

function formatDurationForFilename(seconds) {
  if (seconds == null) return null
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m${String(s).padStart(2, '0')}s`
}

async function importLrclibTrack(id) {
  const track = await fetchLrclibJson(`${LRCLIB_BASE}/get/${id}`)
  if (!track.syncedLyrics) throw new Error('Esta pista no tiene letra sincronizada en lrclib.net')

  const header = [`[ar:${track.artistName}]`, `[ti:${track.trackName}]`]
  if (track.albumName) header.push(`[al:${track.albumName}]`)

  const content = `${header.join('\n')}\n${track.syncedLyrics}\n`

  // la duración distingue versiones con el mismo título (radio edit, álbum, directo…)
  const durationLabel = formatDurationForFilename(track.duration)
  const baseName = durationLabel
    ? `${track.artistName} - ${track.trackName} - ${durationLabel}`
    : `${track.artistName} - ${track.trackName}`

  let name = sanitizeLrcName(baseName)
  if (existsSync(join(LRC_DIR, name))) name = sanitizeLrcName(`${baseName} - id${id}`)

  writeFileSync(join(LRC_DIR, name), content, 'utf-8')
  console.log(`[lrclib] importado: ${name}`)
  return { name, content }
}

// — server —

function serveStatic(req, res) {
  const urlPath = req.url === '/' ? '/index.html' : req.url
  const isSrc   = urlPath.startsWith('/src/')
  const root     = isSrc ? SRC : PUBLIC
  const filePath = join(root, isSrc ? urlPath.slice(4) : urlPath)

  if (!filePath.startsWith(root)) { res.writeHead(403); res.end(); return }

  const mime   = MIME[extname(filePath)] ?? 'application/octet-stream'
  const stream = createReadStream(filePath)
  stream.on('error', () => { res.writeHead(404); res.end() })
  stream.on('open', () => res.writeHead(200, { 'Content-Type': mime }))
  stream.pipe(res)
}

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/translate') {
    let body = ''
    req.on('data', (d) => (body += d))
    req.on('end', async () => {
      try {
        const { text } = JSON.parse(body)
        if (!text) throw new Error('Missing text')

        const key = text.toLowerCase().trim()
        const cache = loadCache()
        if (cache[key]) {
          console.log(`[cache] hit: "${text}" → ${cache[key]}`)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ emojis: cache[key], cached: true }))
          return
        }

        const emojis = await callModel(text)
        cache[key] = emojis
        saveCache(cache)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ emojis }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
    })
    return
  }

  if (req.method === 'POST' && req.url === '/translate-batch') {
    let body = ''
    req.on('data', (d) => (body += d))
    req.on('end', async () => {
      try {
        const { lines } = JSON.parse(body)
        if (!Array.isArray(lines)) throw new Error('Missing lines[]')

        console.log(`[batch] ${lines.length} líneas`)
        const translations = await translateBatch(lines)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ translations }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
    })
    return
  }

  if (req.method === 'GET' && req.url === '/lrc-list') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ files: listSavedLrc() }))
    return
  }

  if (req.method === 'GET' && req.url.startsWith('/lrc-file')) {
    try {
      const { searchParams } = new URL(req.url, `http://localhost:${PORT}`)
      const name = sanitizeLrcName(searchParams.get('name'))
      const filePath = join(LRC_DIR, name)
      if (!existsSync(filePath)) { res.writeHead(404); res.end(); return }
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(readFileSync(filePath, 'utf-8'))
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  if (req.method === 'POST' && req.url === '/lrc-file') {
    let body = ''
    req.on('data', (d) => (body += d))
    req.on('end', () => {
      try {
        const { name, content } = JSON.parse(body)
        const safeName = sanitizeLrcName(name)
        writeFileSync(join(LRC_DIR, safeName), content ?? '', 'utf-8')
        console.log(`[lrc] guardado: ${safeName}`)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ name: safeName }))
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
    })
    return
  }

  if (req.method === 'GET' && req.url.startsWith('/lrclib-search')) {
    try {
      const { searchParams } = new URL(req.url, `http://localhost:${PORT}`)
      const results = await searchLrclib(searchParams.get('track'), searchParams.get('artist'))
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ results }))
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  if (req.method === 'POST' && req.url === '/lrclib-import') {
    let body = ''
    req.on('data', (d) => (body += d))
    req.on('end', async () => {
      try {
        const { id } = JSON.parse(body)
        if (!id) throw new Error('Falta el id de la pista')
        const { name, content } = await importLrclibTrack(id)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ name, content }))
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
    })
    return
  }

  serveStatic(req, res)
})

server.listen(PORT, () => {
  console.log(`lyrics2emoji → http://localhost:${PORT}`)
})
