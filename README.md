# lyrics2emoji

![lyrics2emoji](logo.svg)

Traducción de letras sincronizadas (`.lrc`) a pictogramas poéticos, reproducidos en sincronía con la canción para Hydra.

No es una traducción literal palabra por palabra — cada frase busca la resonancia emocional y conceptual del texto y la convierte en una secuencia de emojis que admita múltiples lecturas, como un rebus o un poema visual.

```
"te quiero a morir"  →  🔥❤️💀
"estoy hecho polvo"  →  🌫️⌛
"todo se derrumba"   →  🏛️💨
```

Se carga un archivo `.lrc` (letra con timestamps, típico de reproductores de música), se traducen todas sus frases de golpe, y un reproductor interno dispara cada traducción en su timestamp exacto — pensado para sonar junto a la música real por otra vía (streaming, vinilo, directo), no para reproducir audio dentro de la propia app.

Los emojis se renderizan en un canvas HTML que Hydra recibe como fuente externa `s0`, permitiendo procesar visualmente el resultado en tiempo real. La frase original se muestra aparte, como texto superpuesto, mientras suenan sus emojis.

---

## Requisitos

- [Node.js](https://nodejs.org) v18+ (usa `fetch` global)
- Acceso a Claude Code (autenticación vía claude.ai — no requiere API key separada)

---

## Instalación

```bash
git clone <repo>
cd lyrics2emoji
npm install
```

Los SVGs de OpenMoji ya están incluidos en `public/openmoji/` (4495 emojis, v17.0.0 color).

---

## Uso

```bash
npm run server
```

Abre **http://localhost:3002** en el navegador.

### Interfaz

| Elemento | Descripción |
|----------|-------------|
| Desplegable "canciones guardadas" | Elige un `.lrc` ya procesado anteriormente — se traduce (desde caché) y queda listo para reproducir |
| **🔎 lrclib** | Busca una canción por "artista - título" en [lrclib.net](https://lrclib.net) e impórtala con un clic |
| **📄 nuevo .lrc** | Sube un archivo `.lrc` local — se guarda automáticamente en el servidor y queda disponible en el desplegable |
| **▶ / ■** | Reproduce / detiene la sincronización de frases |
| Editor Hydra (arriba izquierda) | Escribe el sketch y pulsa **Ctrl+Enter** para ejecutar |
| Slider `bg` (abajo derecha) | Cambia el fondo del canvas de blanco a negro en tiempo real |
| **Tab** | Oculta/muestra el editor (modo performance) |

### Editor Hydra

Los emojis se cargan en `s0`. El editor tiene acceso completo a todos los globales de Hydra — incluyendo `time` y `mouse` — porque el `eval` corre fuera del scope del módulo ES.

```javascript
// directo
src(s0).out(o0)

// movimiento banda subtítulos
src(s0)
 .scrollX(() => time/10)
 .out(o0)

// movimiento ondulante con time
src(s0)
  .scrollX(() => Math.sin(time) * 2)
  .out(o0)

// banda en la franja inferior
src(s0).scale(1, 0.25).scrollY(0.38).out(o0)

// con saturación
src(s0).saturate(2).contrast(1.2).out(o0)

// caleidoscopio
src(s0).kaleid(6).rotate(0.1, 0.01).out(o0)

// hue animado
src(s0).hue(() => time * 0.1).out(o0)

// combinado con noise
noise(() => time * 0.3).layer(src(s0)).out(o0)
```

> Usar `time` directamente da un valor estático. Usar `() => time` lo evalúa cada frame.

---

## Modo LRC

### Formato

Un `.lrc` es texto plano con una línea por frase, precedida de su timestamp:

```
[00:15.44]Turn around
[00:17.33]Every now and then I get a little bit lonely
```

El parser ([`src/lrc/parser.js`](src/lrc/parser.js)) admite varios timestamps por línea (frases repetidas), la etiqueta `[offset:±ms]` para desplazar toda la sincronización, e ignora cualquier otra etiqueta de metadata (`[ar:]`, `[ti:]`, `[al:]`...).

### Reproducción

[`src/player/lrcPlayer.js`](src/player/lrcPlayer.js) no reproduce audio — al pulsar ▶ arranca un reloj interno (`performance.now()`) que dispara cada frase exactamente en su timestamp, para usarse junto a música que suena por otra vía (directo, VJ, streaming en otro dispositivo).

Mientras suenan los emojis de una frase, su texto original aparece en un overlay DOM independiente (mismo estilo que el texto de carga), visible solo durante esa frase — no pasa por el canvas de Hydra, así que no se ve afectado por los efectos del editor.

### Importar canciones desde lrclib.net

[lrclib.net](https://lrclib.net) es una base de datos abierta de letras sincronizadas. Con **🔎 lrclib**:

1. Busca por `artista - título` (o solo el título).
2. Los resultados muestran álbum y duración — útil para distinguir versiones (radio edit, álbum, directo...) del mismo tema.
3. Al elegir una, el servidor descarga su letra sincronizada, la guarda en `data/lrc/` y la traduce automáticamente.

El nombre de archivo incluye la duración (p. ej. `Bonnie Tyler - Total Eclipse of the Heart - 6m57s.lrc`) para que dos versiones del mismo título no se sobrescriban entre sí.

---

## Arquitectura

```
lyrics2emoji/
├── src/
│   ├── translator/
│   │   └── prompt.js        # prompt poético — el artefacto central
│   ├── lrc/
│   │   └── parser.js        # parsea .lrc → [{ time, text }]
│   ├── player/
│   │   └── lrcPlayer.js     # reloj interno que dispara cada frase en su timestamp
│   ├── emojis/
│   │   └── loader.js        # carga SVGs de OpenMoji a tamaño exacto
│   └── renderer/
│       ├── canvas.js        # dibuja banda de emojis en canvas
│       └── hydra.js         # conecta canvas → s0
├── server/
│   └── api.js               # servidor único: estáticos + traducción + LRC + lrclib.net
├── public/
│   ├── openmoji/            # 4495 SVGs (OpenMoji v17.0.0 color)
│   ├── data/
│   │   └── openmoji.json    # metadata de emojis (lookup emoji → hexcode)
│   └── index.html           # UI + Hydra
└── data/
    ├── translations.json    # cache de traducciones (crece con el uso, compartida entre canciones)
    └── lrc/                 # .lrc guardados (subidos a mano o importados de lrclib.net)
```

### Endpoints del servidor

| Ruta | Descripción |
|------|-------------|
| `POST /translate` | Traduce una frase suelta (usa/actualiza la cache) |
| `POST /translate-batch` | Traduce una lista de frases con concurrencia limitada — usado al cargar un `.lrc` |
| `GET /lrc-list` | Lista los `.lrc` guardados en `data/lrc/` |
| `GET /lrc-file?name=` | Devuelve el contenido de un `.lrc` guardado |
| `POST /lrc-file` | Guarda un `.lrc` (subida manual) |
| `GET /lrclib-search?track=&artist=` | Busca en lrclib.net (solo resultados con letra sincronizada) |
| `POST /lrclib-import` | Descarga una pista de lrclib.net por `id`, la guarda como `.lrc` y la devuelve |

### Flujo de traducción sincronizada

```
.lrc → parseLrc() → [{ time, text }]
     → POST /translate-batch (dedupe + cache compartida + Claude Code CLI)
     → al pulsar ▶: reloj interno dispara cada frase en su timestamp
     → emojis → canvas → Hydra lee s0 cada frame
     → frase original → overlay DOM, visible mientras suenan sus emojis
```

### Decisiones técnicas

**Sin API key** — el servidor usa el binario de Claude Code local (`claude --print --system-prompt ...`), heredando la autenticación de la sesión activa. No se necesita `ANTHROPIC_API_KEY`.

**Cache persistente y compartida** — las traducciones se guardan en `data/translations.json`, indexadas por frase normalizada (minúsculas + trim). Cualquier frase ya traducida —venga de la canción que venga— responde sin llamada a la IA.

**Sin audio propio** — el reproductor solo marca el tiempo; la música suena por otra vía. Esto evita lidiar con sincronización audio/red y encaja con el uso pensado (directo, VJ).

**Nombres de archivo seguros** — los nombres de `.lrc` guardados se sanean (`sanitizeLrcName` en `server/api.js`): las barras se reemplazan en vez de truncar (para no perder artistas como "AC/DC"), y cualquier intento de path traversal queda contenido dentro de `data/lrc/`.

**SVGs nítidos** — los SVGs de OpenMoji tienen `viewBox="0 0 72 72"` sin dimensiones explícitas. El loader inyecta `width`/`height` en el XML antes de rasterizar para evitar upscaling desde 72px.

**Canvas full-res** — el canvas de emojis se crea a `innerWidth × innerHeight × devicePixelRatio` para que Hydra lo mapee 1:1 sin escalar.

**Fondo configurable** — el color de fondo del canvas es una variable exportada (`setBgColor`). El slider `bg` actualiza el color y llama a `refreshCanvas()` para re-renderizar sin esperar nueva traducción.

---

## Prompt

El prompt está en [`src/translator/prompt.js`](src/translator/prompt.js). Es el artefacto más importante del proyecto — ajustarlo cambia radicalmente el carácter de las traducciones.

El criterio actual prioriza **ambigüedad poética** sobre claridad: metáforas visuales, resonancia emocional, espacio para la interpretación del espectador.

---

## Créditos

- Emojis: [OpenMoji](https://openmoji.org) — CC BY-SA 4.0
- Letras sincronizadas: [lrclib.net](https://lrclib.net) — base de datos abierta y comunitaria
- Síntesis visual: [Hydra](https://hydra.ojack.xyz) — Olivia Jack
- Traducción: [Claude](https://anthropic.com) — Anthropic
