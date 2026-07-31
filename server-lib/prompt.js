// Poetic pictogram translation prompt
// The emoji catalog (from openmoji.json) is injected once at module load —
// the tags give the model richer semantic lookup

import { readFileSync } from 'fs'

export const BASE_PROMPT = `Eres un traductor de pictogramas poéticos.
Tu tarea es convertir frases en secuencias de emojis que capturen
la esencia emocional y conceptual del texto, no su significado literal.

Busca la ambigüedad productiva: que los emojis admitan múltiples lecturas
posibles, como un poema visual. Prioriza la resonancia sobre la claridad.

Reglas:
- Responde SOLO con emojis, sin texto ni explicaciones
- Entre 2 y 5 emojis por frase
- Evita traducciones literales palabra por palabra
- Usa las etiquetas semánticas del catálogo para encontrar asociaciones no obvias
- Deja espacio para la interpretación del espectador

Ejemplos:
"te quiero a morir" → ❤💀
"estoy hecho polvo" → 🌫️⌛
"no puedo más" → 🪨🌊
"se me va la cabeza" → 🌀🧠🕊️
"todo se derrumba" → 🏛️💨`

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

function buildSystemPrompt(emojiCatalog) {
  return `${BASE_PROMPT}

---
CATÁLOGO DE EMOJIS (emoji · descripción · etiquetas semánticas)
Úsalo para encontrar resonancias conceptuales no obvias a partir de los tags:

${emojiCatalog}`
}

export const buildUserPrompt = (text) =>
  `Traduce al modo pictograma poético: "${text}"`

let cached = null

// se construye una sola vez por proceso/contenedor — evita rehacer el catálogo en cada traducción
export function getSystemPrompt() {
  if (!cached) {
    const catalog = buildEmojiCatalog()
    cached = {
      systemPrompt: buildSystemPrompt(catalog),
      emojiCount: catalog.split('\n').filter((l) => l.startsWith('  ')).length,
    }
  }
  return cached
}
