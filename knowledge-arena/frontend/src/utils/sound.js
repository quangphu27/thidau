// Sound helpers — browsers may block autoplay until user gesture
let enabled = true

export function setSoundEnabled(v) {
  enabled = !!v
  try {
    localStorage.setItem('arena_sound', enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function loadSoundPref() {
  try {
    const v = localStorage.getItem('arena_sound')
    if (v === '0') enabled = false
  } catch {
    /* ignore */
  }
  return enabled
}

function beep(freq, duration = 0.15, type = 'sine', volume = 0.08) {
  if (!enabled) return
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.value = freq
    g.gain.value = volume
    o.connect(g)
    g.connect(ctx.destination)
    o.start()
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    o.stop(ctx.currentTime + duration)
    setTimeout(() => ctx.close(), duration * 1000 + 50)
  } catch {
    /* ignore */
  }
}

export const sounds = {
  correct: () => {
    beep(880, 0.1)
    setTimeout(() => beep(1175, 0.2), 100)
  },
  wrong: () => beep(220, 0.3, 'sawtooth', 0.06),
  tick: () => beep(660, 0.05, 'square', 0.04),
  start: () => beep(523, 0.15),
  win: () => {
    ;[523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.2), i * 120))
  },
}
