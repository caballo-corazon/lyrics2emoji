import { createServer } from 'http'
import { createReadStream, mkdirSync, writeFileSync } from 'fs'
import { join, extname, resolve } from 'path'
import {
  translate,
  translateBatch,
  lrcList,
  lrcFileGet,
  lrcFileSave,
  lrclibSearch,
  lrclibImport,
} from '../server-lib/routes.js'
import { getSystemPrompt } from '../server-lib/prompt.js'

const PORT   = 3002
const PUBLIC = resolve('./public')
const SRC    = resolve('./src')

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.css':  'text/css',
  '.png':  'image/png',
}

const { systemPrompt, emojiCount } = getSystemPrompt()
console.log(`system prompt: ${(systemPrompt.length / 1024).toFixed(1)} KB — ${emojiCount} emojis`)

// solo para poder inspeccionarlo a mano en local — en Lambda el filesystem es de solo lectura
try {
  mkdirSync('./data', { recursive: true })
  writeFileSync('./data/system-prompt.txt', systemPrompt)
} catch (e) {
  console.warn(`no se pudo escribir data/system-prompt.txt: ${e.message}`)
}

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

function readBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (d) => (body += d))
    req.on('end', () => resolve(body))
  })
}

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/translate') {
    try {
      const { text } = JSON.parse(await readBody(req))
      const result = await translate(text)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  if (req.method === 'POST' && req.url === '/translate-batch') {
    try {
      const { lines } = JSON.parse(await readBody(req))
      const result = await translateBatch(lines)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  if (req.method === 'GET' && req.url === '/lrc-list') {
    try {
      const result = await lrcList()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  if (req.method === 'GET' && req.url.startsWith('/lrc-file')) {
    try {
      const { searchParams } = new URL(req.url, `http://localhost:${PORT}`)
      const content = await lrcFileGet(searchParams.get('name'))
      if (content == null) { res.writeHead(404); res.end(); return }
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(content)
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  if (req.method === 'POST' && req.url === '/lrc-file') {
    try {
      const { name, content } = JSON.parse(await readBody(req))
      const result = await lrcFileSave(name, content)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  if (req.method === 'GET' && req.url.startsWith('/lrclib-search')) {
    try {
      const { searchParams } = new URL(req.url, `http://localhost:${PORT}`)
      const result = await lrclibSearch(searchParams.get('track'), searchParams.get('artist'))
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  if (req.method === 'POST' && req.url === '/lrclib-import') {
    try {
      const { id } = JSON.parse(await readBody(req))
      const result = await lrclibImport(id)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  serveStatic(req, res)
})

server.listen(PORT, () => {
  console.log(`lyrics2emoji → http://localhost:${PORT}`)
})
