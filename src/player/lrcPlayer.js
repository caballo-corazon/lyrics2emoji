// Reproductor sincronizado para entradas parseadas de un .lrc
// No reproduce audio — dispara onLine() en el timestamp de cada frase
// usando un reloj interno (performance.now()), para usarse junto a
// música que suena por otra vía (directo/VJ).

export function createLrcPlayer({ onLine, onEnd }) {
  let entries = []
  let rafId = null
  let startPerf = 0
  let index = -1
  let playing = false

  function load(parsedEntries) {
    entries = parsedEntries
    index = -1
  }

  function tick() {
    if (!playing) return
    const elapsed = (performance.now() - startPerf) / 1000

    while (index + 1 < entries.length && entries[index + 1].time <= elapsed) {
      index++
      onLine(entries[index], index)
    }

    if (index >= entries.length - 1) {
      playing = false
      onEnd?.()
      return
    }

    rafId = requestAnimationFrame(tick)
  }

  function play() {
    if (playing || entries.length === 0) return
    playing = true
    index = -1
    startPerf = performance.now()
    tick()
  }

  function stop() {
    playing = false
    if (rafId) cancelAnimationFrame(rafId)
    rafId = null
    index = -1
  }

  return {
    load,
    play,
    stop,
    get playing() { return playing },
  }
}
