import { lrcExists, writeLrc, sanitizeLrcName } from './lrcStorage.js'

const LRCLIB_BASE = 'https://lrclib.net/api'
const LRCLIB_HEADERS = { 'User-Agent': 'lyrics2emoji (https://github.com) - personal project' }

async function fetchLrclibJson(url) {
  const res = await fetch(url, { headers: LRCLIB_HEADERS })
  if (!res.ok) throw new Error(`lrclib.net respondió ${res.status}`)
  return res.json()
}

export async function searchLrclib(track, artist) {
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

export async function importLrclibTrack(id) {
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
  if (await lrcExists(name)) name = sanitizeLrcName(`${baseName} - id${id}`)

  const savedName = await writeLrc(name, content)
  console.log(`[lrclib] importado: ${savedName}`)
  return { name: savedName, content }
}
