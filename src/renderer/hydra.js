import { createEmojiCanvas, renderEmojiStrip, transitionTo, startLoading, stopLoading, setBgColor, fillBackground } from './canvas.js'

export { setBgColor }

let emojiCanvas = null
let lastEmojiString = null

export function initHydra() {
  // Read Hydra's actual canvas dimensions after init — if Hydra ignores the
  // width/height constructor options the mismatched sizes cause NEAREST-filter
  // downsampling that makes text look pixelated.
  const hCanvas = document.getElementById('hydra-canvas')
  const dpr = window.devicePixelRatio || 1
  const w = hCanvas.width  || Math.round(window.innerWidth  * dpr)
  const h = hCanvas.height || Math.round(window.innerHeight * dpr)

  emojiCanvas = createEmojiCanvas(w, h)
  fillBackground(emojiCanvas)
  console.log(`[hydra] output ${w}×${h} | emoji canvas ${emojiCanvas.width}×${emojiCanvas.height} (dpr ${dpr})`)
  window.s0.init({ src: emojiCanvas, dynamic: true })
  console.log('[hydra] s0 initialized')
  return emojiCanvas
}

export function showText(text) {
  if (!emojiCanvas) throw new Error('Call initHydra() first')
  startLoading(emojiCanvas, text)
}

export function clearCanvas() {
  if (!emojiCanvas) return
  stopLoading()
  lastEmojiString = null
  fillBackground(emojiCanvas)
}

export async function showEmojis(emojiString, animate = true) {
  if (!emojiCanvas) throw new Error('Call initHydra() first')
  lastEmojiString = emojiString
  if (animate) {
    await transitionTo(emojiCanvas, emojiString)
  } else {
    stopLoading()
    await renderEmojiStrip(emojiCanvas, emojiString)
  }
}

export async function refreshCanvas() {
  if (!emojiCanvas) return
  if (lastEmojiString) {
    await renderEmojiStrip(emojiCanvas, lastEmojiString)
  } else {
    fillBackground(emojiCanvas)
  }
}
