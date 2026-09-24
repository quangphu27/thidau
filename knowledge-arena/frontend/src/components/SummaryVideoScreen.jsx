import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { mediaUrl } from '../utils/config'

/**
 * Video tổng kết toàn màn hình + phụ đề theo đoạn + nhạc nền.
 */
export default function SummaryVideoScreen({
  title = '',
  url,
  bgmUrl = '',
  bgmVolume = 0.55,
  cues = [],
  onDone,
  skipLabel = 'Bỏ qua → Vinh danh',
}) {
  const videoRef = useRef(null)
  const bgmRef = useRef(null)
  const [time, setTime] = useState(0)
  const [needTap, setNeedTap] = useState(false)
  const [ended, setEnded] = useState(false)
  const doneRef = useRef(false)

  const src = url ? mediaUrl(url) : ''
  const bgmSrc = bgmUrl ? mediaUrl(bgmUrl) : ''

  const activeCue = useMemo(() => {
    return cues.find((c) => time >= c.start && time < c.end) || null
  }, [cues, time])

  const stopAll = () => {
    const v = videoRef.current
    const a = bgmRef.current
    if (v) {
      v.pause()
      try {
        v.currentTime = 0
      } catch {
        /* ignore */
      }
    }
    if (a) {
      a.pause()
      a.currentTime = 0
    }
  }

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    stopAll()
    onDone?.()
  }

  const playBoth = async () => {
    const v = videoRef.current
    const a = bgmRef.current
    if (!v) return false
    try {
      v.currentTime = 0
      if (a) {
        a.currentTime = 0
        a.volume = Math.min(1, Math.max(0, bgmVolume))
        await a.play()
      }
      await v.play()
      setNeedTap(false)
      return true
    } catch {
      if (a) a.pause()
      setNeedTap(true)
      return false
    }
  }

  useEffect(() => {
    if (!src) return undefined
    let cancelled = false
    doneRef.current = false
    const t = setTimeout(() => {
      if (!cancelled) playBoth()
    }, 80)
    return () => {
      cancelled = true
      clearTimeout(t)
      stopAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, bgmSrc])

  if (!src) {
    onDone?.()
    return null
  }

  const cueIndex = activeCue ? cues.findIndex((c) => c === activeCue) + 1 : 0

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black">
      {bgmSrc ? (
        <audio ref={bgmRef} src={bgmSrc} preload="auto" loop={false} />
      ) : null}

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <video
          ref={videoRef}
          key={src}
          className="absolute inset-0 h-full w-full object-contain"
          src={src}
          playsInline
          preload="auto"
          muted={false}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime || 0)}
          onEnded={() => {
            setEnded(true)
            const a = bgmRef.current
            if (a) {
              // fade nhạc nền rồi kết thúc
              const startVol = a.volume
              const start = performance.now()
              const fade = (now) => {
                const t = Math.min(1, (now - start) / 800)
                a.volume = startVol * (1 - t)
                if (t < 1) {
                  requestAnimationFrame(fade)
                } else {
                  a.pause()
                  setTimeout(finish, 200)
                }
              }
              requestAnimationFrame(fade)
            } else {
              setTimeout(finish, 900)
            }
          }}
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40" />

        <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 px-4 py-4 text-center md:py-6">
          <p className="font-display text-xs font-bold tracking-[0.25em] text-amber-300/90 md:text-sm">
            VIDEO TỔNG KẾT
          </p>
          {title ? (
            <h1 className="mt-1 font-display text-lg font-black text-white drop-shadow md:text-3xl">
              {title}
            </h1>
          ) : null}
        </div>

        <AnimatePresence mode="wait">
          {activeCue ? (
            <motion.div
              key={activeCue.text}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="pointer-events-none absolute bottom-24 left-1/2 z-20 w-[min(92vw,52rem)] -translate-x-1/2 px-3 md:bottom-28"
            >
              <p className="rounded-2xl bg-black/75 px-4 py-3 text-center font-display text-base font-bold leading-snug text-white shadow-2xl backdrop-blur-sm md:px-6 md:py-4 md:text-2xl">
                {activeCue.text}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {needTap && (
          <button
            type="button"
            onClick={playBoth}
            className="absolute z-30 rounded-full bg-amber-400 px-6 py-3 font-display text-lg font-black text-arena-ink shadow-xl"
          >
            ▶️ Bấm để xem (có nhạc)
          </button>
        )}

        {ended && (
          <p className="absolute bottom-10 z-30 font-display text-sm font-bold text-amber-200">
            Đang chuyển sang vinh danh…
          </p>
        )}
      </div>

      <div className="relative z-20 flex shrink-0 items-center justify-between gap-3 bg-black/90 px-4 py-3">
        <p className="text-xs font-bold text-white/50">
          {Math.floor(time)}s
          {cues.length ? ` · đoạn ${cueIndex || '—'}/${cues.length}` : ''}
          {bgmSrc ? ' · 🎵 nhạc nền' : ''}
        </p>
        <button
          type="button"
          onClick={finish}
          className="rounded-full border-2 border-amber-300/60 bg-amber-400/20 px-4 py-2 text-sm font-black text-amber-100 hover:bg-amber-400/35"
        >
          {skipLabel}
        </button>
      </div>
    </div>
  )
}
