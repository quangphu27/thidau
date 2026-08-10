import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { errorMessage } from '../utils/config'
import { sounds } from '../utils/sound'

export default function AnswerToast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return undefined
    if (toast.kind === 'correct') sounds.correct()
    else if (toast.kind === 'wrong') sounds.wrong()
    // Correct: short chip — arena Solo-kill FX must stay visible
    const ms =
      toast.kind === 'announce'
        ? 5500
        : toast.kind === 'correct'
          ? 1800
          : toast.kind === 'error'
            ? 2500
            : 3000
    const t = setTimeout(onDone, ms)
    return () => clearTimeout(t)
  }, [toast, onDone])

  if (!toast) return null

  const kind = toast.kind
  const msg = toast.code && kind !== 'announce' ? errorMessage(toast.code) || toast.message : toast.message
  const isAnnounce = kind === 'announce'
  const isCorrect = kind === 'correct'

  // Compact top chip for correct answers — không che đấu trường Solo kill
  if (isCorrect) {
    return (
      <AnimatePresence>
        <motion.div
          key={`chip-${toast.title}-${toast.message}`}
          initial={{ opacity: 0, y: -24, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-3 md:top-4"
        >
          <div className="flex max-w-xl items-center gap-3 rounded-2xl border-2 border-white bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 shadow-xl md:px-5 md:py-3">
            <span className="text-2xl">🎉</span>
            <div className="min-w-0 text-left">
              <p className="truncate font-display text-sm font-black uppercase text-white md:text-base">
                {toast.title}
              </p>
              <p className="truncate text-xs font-bold text-white/90 md:text-sm">
                Đúng!{toast.points != null ? ` +${toast.points} điểm` : ''}
              </p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    )
  }

  const bg =
    kind === 'wrong'
      ? 'from-rose-600/95 to-red-700/95'
      : kind === 'locked-wrong'
        ? 'from-orange-500/95 to-amber-600/95'
        : kind === 'announce'
          ? 'from-[#ffb703] via-[#ff8c42] to-[#ff5a36]'
          : 'from-sky-500/95 to-indigo-600/95'

  return (
    <AnimatePresence>
      <motion.div
        key={`${toast.kind}-${toast.title}-${toast.message}`}
        initial={{ opacity: 0, scale: 0.7, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ type: 'spring', stiffness: 280, damping: 20 }}
        className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          className={`w-full rounded-3xl bg-gradient-to-br ${bg} text-center shadow-2xl ${
            isAnnounce
              ? 'max-w-3xl border-4 border-white p-8 md:p-12'
              : 'max-w-lg p-8'
          }`}
        >
          {kind === 'wrong' && <div className="mb-2 text-5xl">❌</div>}
          {isAnnounce && <div className="mb-3 text-6xl md:text-7xl">📢</div>}
          {(kind === 'locked' || kind === 'locked-wrong') && (
            <div className="mb-2 text-5xl">⚡</div>
          )}
          <h2
            className={`font-display font-black uppercase tracking-wide text-white ${
              isAnnounce ? 'text-3xl md:text-5xl' : 'text-2xl md:text-3xl'
            }`}
          >
            {toast.title}
          </h2>
          <p
            className={`mt-4 font-black text-white drop-shadow ${
              isAnnounce
                ? 'text-2xl leading-snug md:text-4xl md:leading-tight'
                : 'text-lg font-semibold text-white/95'
            }`}
          >
            {msg}
          </p>
          {kind === 'wrong' && (
            <p className="mt-4 font-display text-3xl font-black text-white">
              {toast.points ?? -10} ĐIỂM
            </p>
          )}
          {(kind === 'locked-wrong' || kind === 'wrong') && toast.answer_display && (
            <p className="mt-2 text-base text-white/90">
              Lựa chọn: <strong>{toast.answer_display}</strong>
            </p>
          )}
          {kind === 'locked-wrong' && toast.points != null && (
            <p className="mt-2 font-display text-xl font-bold text-white/90">
              {toast.points} điểm
            </p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
