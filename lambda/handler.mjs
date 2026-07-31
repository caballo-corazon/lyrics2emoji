import {
  translate,
  translateBatch,
  lrcList,
  lrcFileGet,
  lrcFileSave,
  lrclibSearch,
  lrclibImport,
} from '../server-lib/routes.js'

function json(statusCode, data) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
}

async function respond(errorStatus, fn) {
  try {
    return json(200, await fn())
  } catch (e) {
    return json(errorStatus, { error: e.message })
  }
}

function parseBody(event) {
  if (!event.body) return {}
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf-8') : event.body
  return JSON.parse(raw)
}

export const handler = async (event) => {
  // la Function URL es pública (auth NONE) — solo CloudFront conoce este secreto,
  // que manda en cada petición vía un custom_header fijo en el origen
  if (event.headers?.['x-origin-verify'] !== process.env.ORIGIN_SECRET) {
    return json(403, { error: 'Forbidden' })
  }

  const method = event.requestContext.http.method
  const path = event.rawPath
  const params = event.queryStringParameters ?? {}

  if (method === 'POST' && path === '/translate') {
    return respond(500, () => translate(parseBody(event).text))
  }

  if (method === 'POST' && path === '/translate-batch') {
    return respond(500, () => translateBatch(parseBody(event).lines))
  }

  if (method === 'GET' && path === '/lrc-list') {
    return respond(500, () => lrcList())
  }

  if (method === 'GET' && path === '/lrc-file') {
    try {
      const content = await lrcFileGet(params.name)
      if (content == null) return { statusCode: 404, body: '' }
      return { statusCode: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: content }
    } catch (e) {
      return json(400, { error: e.message })
    }
  }

  if (method === 'POST' && path === '/lrc-file') {
    const { name, content } = parseBody(event)
    return respond(400, () => lrcFileSave(name, content))
  }

  if (method === 'GET' && path === '/lrclib-search') {
    return respond(400, () => lrclibSearch(params.track, params.artist))
  }

  if (method === 'POST' && path === '/lrclib-import') {
    return respond(400, () => lrclibImport(parseBody(event).id))
  }

  return json(404, { error: 'Not found' })
}
