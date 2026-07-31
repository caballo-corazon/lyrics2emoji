// Reproductor sincronizado para entradas parseadas de un .lrc
// No reproduce audio — dispara onLine() en el timestamp de cada frase
// usando un reloj interno (performance.now()), para usarse junto a
// música que suena por otra vía (directo/VJ).

export function createLrcPlayer({ onLine, onEnd }) {
  let entries = []
  let rafId = null
  let startPerf = 0
  let pausedElapsed = 0
  let index = -1
  let playing = false
  let paused = false

  function load(parsedEntries) {
    entries = parsedEntries
    index = -1
    paused = false
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
    paused = false
    index = -1
    startPerf = performance.now()
    tick()
  }

  // congela el reloj en el punto actual — a diferencia de stop(), no reinicia
  // index ni el tiempo, así resume() continúa exactamente donde se quedó
  function pause() {
    if (!playing) return
    playing = false
    paused = true
    pausedElapsed = (performance.now() - startPerf) / 1000
    if (rafId) cancelAnimationFrame(rafId)
    rafId = null
  }

  function resume() {
    if (playing || !paused) return
    playing = true
    paused = false
    startPerf = performance.now() - pausedElapsed * 1000
    tick()
  }

  function stop() {
    playing = false
    paused = false
    if (rafId) cancelAnimationFrame(rafId)
    rafId = null
    index = -1
  }

  return {
    load,
    play,
    pause,
    resume,
    stop,
    get playing() { return playing },
    get paused() { return paused },
  }
}
