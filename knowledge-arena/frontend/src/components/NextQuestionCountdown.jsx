import { motion, AnimatePresence } from 'framer-motion'

/** Full-screen style countdown after correct-answer attack FX */
export default function NextQuestionCountdown({ seconds, winnerName }) {
  if (seconds == null || seconds < 0) return null
  return (
    <AnimatePresence>
      <motion.div
        key="next-cd"
        className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-arena-ink/35 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="rounded-[2rem] border-4 border-white bg-white/95 px-8 py-6 text-center shadow-2xl"
          initial={{ scale: 0.85, y: 16 }}
          animate={{ scale: 1, y: 0 }}
        >
          <p className="text-sm font-bold text-arena-ink/55">
            {winnerName ? `${winnerName} chiến thắng vòng này!` : 'Chuẩn bị câu tiếp theo'}
          </p>
          <motion.p
            key={seconds}
            className="mt-2 font-display text-6xl font-black text-arena-accent md:text-7xl"
            initial={{ scale: 1.35, opacity: 0.4 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
          >
            {seconds}
          </motion.p>
          <p className="mt-1 font-extrabold text-arena-cyan">Câu hỏi tiếp theo...</p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
