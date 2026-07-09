// Parser de archivos .lrc (letras sincronizadas)
// Formato: [mm:ss.xx] texto — admite varios timestamps por línea, [offset:±ms]
// y etiquetas de metadata tipo [ar:Artista] / [ti:Título] / [al:Álbum]

const TIME_TAG = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g
const OFFSET_TAG = /^\[offset:\s*([+-]?\d+)\]$/i
const ID_TAG = /^\[(\w+):(.*)\]$/

export function parseLrc(raw) {
  const lines = raw.split(/\r?\n/)
  let offsetMs = 0
  const entries = []
  const meta = {}

  for (const line of lines) {
    const offsetMatch = line.match(OFFSET_TAG)
    if (offsetMatch) { offsetMs = Number(offsetMatch[1]); continue }

    const tags = [...line.matchAll(TIME_TAG)]
    if (tags.length === 0) {
      const idMatch = line.match(ID_TAG)
      if (idMatch) meta[idMatch[1].toLowerCase()] = idMatch[2].trim()
      continue
    }

    const text = line.replace(TIME_TAG, '').trim()
    if (!text) continue

    for (const [, mm, ss, frac = '0'] of tags) {
      const time = Number(mm) * 60 + Number(ss) + Number(`0.${frac}`)
      entries.push({ time, text })
    }
  }

  entries.sort((a, b) => a.time - b.time)
  if (offsetMs) {
    for (const e of entries) e.time += offsetMs / 1000
  }
  return { entries, meta }
}
