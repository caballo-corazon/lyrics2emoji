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

Alojado públicamente en AWS (Lambda + DynamoDB + S3 + CloudFront), desplegado con Terraform.

Punto de entrada estable: **https://caballo-corazon.github.io/lyrics2emoji/** (redirige al dominio real de CloudFront — ver [GitHub Pages](#github-pages)).

---

## Requisitos

- [Node.js](https://nodejs.org) v20+ (usa `fetch` global y la flag `--env-file`)
- Una cuenta de AWS con acceso habilitado a un modelo de [Amazon Bedrock](https://aws.amazon.com/bedrock/) (por defecto, el perfil de inferencia `eu.amazon.nova-micro-v1:0`) en la región que uses
- [AWS CLI](https://aws.amazon.com/cli/) configurado (`aws configure --profile <tu-perfil>`)
- [Terraform](https://developer.hashicorp.com/terraform) ≥ 1.5, si vas a desplegar o modificar la infraestructura de `infra/`

---

## Instalación

```bash
git clone <repo>
cd lyrics2emoji
npm install
cp .env.example .env
```

Edita `.env` con tu perfil y región de AWS. `DYNAMODB_TABLE` y `LRC_BUCKET` se rellenan con la salida de Terraform tras el primer despliegue (ver [Despliegue en AWS](#despliegue-en-aws)) — hasta entonces, el servidor local no podrá cachear traducciones ni guardar `.lrc`.

Los SVGs de OpenMoji ya están incluidos en `public/openmoji/` (4495 emojis, v17.0.0 color).

---

## Uso

```bash
npm run server
```

Abre **http://localhost:3002** en el navegador.

El servidor local sirve el frontend y, para la API, llama a las mismas funciones (`server-lib/`) que usa la Lambda en producción — es decir, en desarrollo local ya se habla con los recursos reales de AWS (Bedrock, DynamoDB, S3), no con una simulación. Por eso hace falta tener la infraestructura desplegada primero.

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
3. Al elegir una, el servidor descarga su letra sincronizada, la guarda en S3 y la traduce automáticamente.

El nombre de archivo incluye la duración (p. ej. `Bonnie Tyler - Total Eclipse of the Heart - 6m57s.lrc`) para que dos versiones del mismo título no se sobrescriban entre sí.

---

## Arquitectura

```
lyrics2emoji/
├── src/                        # todo lo que corre en el navegador (se sube tal cual a S3)
│   ├── lrc/parser.js           # parsea .lrc → [{ time, text }]
│   ├── player/lrcPlayer.js     # reloj interno que dispara cada frase en su timestamp
│   ├── emojis/loader.js        # carga SVGs de OpenMoji a tamaño exacto
│   └── renderer/
│       ├── canvas.js           # dibuja banda de emojis en canvas
│       └── hydra.js            # conecta canvas → s0
├── server-lib/                 # lógica de backend — sin HTTP, la usan server/ y lambda/ por igual
│   ├── prompt.js                # catálogo de emojis + prompt poético — el artefacto central
│   ├── bedrock.js               # llamada a Amazon Bedrock
│   ├── cache.js                  # cache de traducciones sobre DynamoDB
│   ├── lrcStorage.js             # guardado/lectura de .lrc sobre S3
│   ├── lrclib.js                  # proxy a lrclib.net
│   └── routes.js                  # una función por endpoint (traducir, listar, buscar...)
├── server/
│   └── api.js                  # servidor local: estáticos (public/ + src/) + llama a server-lib/routes.js
├── lambda/
│   └── handler.mjs             # adaptador Lambda Function URL → server-lib/routes.js
├── infra/                      # Terraform: toda la infraestructura de AWS
│   └── templates/
│       └── redirect.html.tftpl  # plantilla del index.html de docs/ (ver GitHub Pages)
├── docs/
│   └── index.html              # redirección a CloudFront — generado por Terraform, no a mano
├── scripts/
│   ├── migrate-data.mjs        # vuelca la cache/lrc locales a AWS (uso puntual, una vez)
│   └── deploy-frontend.sh      # sube public/ + src/ al bucket S3 del frontend
├── public/
│   ├── openmoji/                # 4495 SVGs (OpenMoji v17.0.0 color)
│   ├── data/
│   │   └── openmoji.json        # metadata de emojis (lookup emoji → hexcode)
│   └── index.html               # UI + Hydra
└── data/                        # solo desarrollo/histórico — la fuente de verdad real vive en AWS
    ├── translations.json
    └── lrc/
```

### Endpoints

| Ruta | Descripción |
|------|-------------|
| `POST /translate` | Traduce una frase suelta (usa/actualiza la cache) |
| `POST /translate-batch` | Traduce una lista de frases con concurrencia limitada — usado al cargar un `.lrc` |
| `GET /lrc-list` | Lista los `.lrc` guardados |
| `GET /lrc-file?name=` | Devuelve el contenido de un `.lrc` guardado |
| `POST /lrc-file` | Guarda un `.lrc` (subida manual) |
| `GET /lrclib-search?track=&artist=` | Busca en lrclib.net (solo resultados con letra sincronizada) |
| `POST /lrclib-import` | Descarga una pista de lrclib.net por `id`, la guarda y la devuelve |

En local, estas rutas las sirve `server/api.js`; en producción, la misma lógica (`server-lib/routes.js`) corre dentro de la Lambda detrás de CloudFront — el cliente (`public/index.html`) hace exactamente las mismas llamadas relativas en ambos casos.

### Flujo de traducción sincronizada

```
.lrc → parseLrc() → [{ time, text }]
     → POST /translate-batch (dedupe + cache en DynamoDB + Amazon Bedrock)
     → al pulsar ▶: reloj interno dispara cada frase en su timestamp
     → emojis → canvas → Hydra lee s0 cada frame
     → frase original → overlay DOM, visible mientras suenan sus emojis
```

### Decisiones técnicas

**Un único origen de verdad para la lógica de negocio** — `server-lib/routes.js` no sabe nada de HTTP ni de Lambda; tanto `server/api.js` (desarrollo local) como `lambda/handler.mjs` (producción) son adaptadores finos alrededor de las mismas funciones, contra los mismos recursos de AWS.

**Sin API key propia** — ni Bedrock ni DynamoDB ni S3 necesitan una clave embebida en el código: en local se usan las credenciales del perfil de AWS (`AWS_PROFILE`), y en Lambda, el rol IAM de la función.

**Mismo dominio para frontend y API** — CloudFront sirve `public/` + `src/` desde S3 (privado, vía Origin Access Control) como comportamiento por defecto, y enruta `/translate*` y `/lrc*` a la Lambda por patrón de ruta. El navegador nunca ve un dominio distinto ni necesita CORS — las llamadas `fetch` de `index.html` son idénticas en local y en producción.

**Function URL pública pero verificada** — la Lambda se invoca vía [Function URL](https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html) con `auth NONE` (más simple y barato que API Gateway), protegida por una cabecera secreta (`X-Origin-Verify`) que solo CloudFront conoce y que el handler comprueba antes de procesar nada — así una llamada directa a la Function URL, saltándose CloudFront, se rechaza.

**Cache persistente y compartida** — las traducciones se guardan en DynamoDB, indexadas por frase normalizada (minúsculas + trim). Cualquier frase ya traducida —venga de la canción que venga— responde sin llamada al modelo.

**Sin audio propio** — el reproductor solo marca el tiempo; la música suena por otra vía. Esto evita lidiar con sincronización audio/red y encaja con el uso pensado (directo, VJ).

**Nombres de archivo seguros** — los nombres de `.lrc` se sanean (`sanitizeLrcName` en `server-lib/lrcStorage.js`): las barras se reemplazan en vez de truncar (para no perder artistas como "AC/DC"), y cualquier intento de path traversal queda contenido.

**SVGs nítidos** — los SVGs de OpenMoji tienen `viewBox="0 0 72 72"` sin dimensiones explícitas. El loader inyecta `width`/`height` en el XML antes de rasterizar para evitar upscaling desde 72px.

**Canvas full-res** — el canvas de emojis se crea a `innerWidth × innerHeight × devicePixelRatio` para que Hydra lo mapee 1:1 sin escalar.

**Fondo configurable** — el color de fondo del canvas es una variable exportada (`setBgColor`). El slider `bg` actualiza el color y llama a `refreshCanvas()` para re-renderizar sin esperar nueva traducción.

---

## Despliegue en AWS

La infraestructura vive en `infra/` (Terraform): Lambda + Function URL, DynamoDB, dos buckets S3 (frontend y `.lrc`), CloudFront, IAM.

### Primer despliegue

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # ajusta aws_profile y aws_region
terraform init
terraform apply
```

La salida incluye `dynamodb_table_name`, `lrc_bucket_name` y `cloudfront_domain` — copia los dos primeros a tu `.env` (`DYNAMODB_TABLE`, `LRC_BUCKET`).

### Migrar datos existentes (una sola vez)

Si vienes de una `data/translations.json` y una `data/lrc/` locales:

```bash
node --env-file=.env scripts/migrate-data.mjs
```

### Desplegar

```bash
./scripts/deploy.sh
```

Punto único de despliegue: aplica los cambios de `infra/` (`terraform apply` — sin `-auto-approve`, así que si no hay cambios pasa de largo en segundos, y si los hay te muestra el plan y pide confirmación antes de tocar nada) y a continuación sincroniza el frontend.

Si solo quieres subir cambios de `public/` o `src/` sin pasar por Terraform, puedes llamar directamente a `./scripts/deploy-frontend.sh` (`aws s3 sync --delete`, así que también borra lo que ya no exista localmente).

### Notas

- **Región y modelo de Bedrock**: por defecto `eu-west-1` y el perfil de inferencia `eu.amazon.nova-micro-v1:0`, configurables como variables de Terraform (`aws_region`, `bedrock_model_id`) y de entorno (`AWS_REGION`, `BEDROCK_MODEL_ID`).
- **Coste**: pensado para uso esporádico — DynamoDB y Lambda en modo *pay-per-request*, CloudFront dentro de su capa gratuita para este volumen.
- **Estado de Terraform**: local (`infra/terraform.tfstate`, en `.gitignore`) — proyecto personal en solitario, sin backend remoto por ahora.
- **Etiquetas**: todos los recursos que lo soportan llevan `Project`, `ManagedBy` y `CostCenter` (`default_tags` en `infra/provider.tf`).

### GitHub Pages

`docs/index.html` es una página de redirección a la URL real de CloudFront — sirve como enlace corto y estable (`https://caballo-corazon.github.io/lyrics2emoji/`) aunque el dominio de CloudFront cambie el día de mañana (p. ej. al recrear la distribución).

No se edita a mano: lo genera el recurso `local_file` de `infra/github-pages.tf` a partir de la plantilla `infra/templates/redirect.html.tftpl`, en cada `terraform apply`. Solo hay que activarlo una vez en GitHub: `Settings → Pages → Deploy from a branch → main /docs`.

> La barra de direcciones cambia a la URL de CloudFront tras la redirección — es un punto de entrada, no un dominio propio persistente (para eso haría falta un dominio real + certificado ACM en CloudFront, pendiente).

---

## Prompt

El prompt está en [`server-lib/prompt.js`](server-lib/prompt.js). Es el artefacto más importante del proyecto — ajustarlo cambia radicalmente el carácter de las traducciones.

El criterio actual prioriza **ambigüedad poética** sobre claridad: metáforas visuales, resonancia emocional, espacio para la interpretación del espectador.

---

## Créditos

- Emojis: [OpenMoji](https://openmoji.org) — CC BY-SA 4.0
- Letras sincronizadas: [lrclib.net](https://lrclib.net) — base de datos abierta y comunitaria
- Síntesis visual: [Hydra](https://hydra.ojack.xyz) — Olivia Jack
- Traducción: [Amazon Bedrock](https://aws.amazon.com/bedrock/) (Nova Micro)
