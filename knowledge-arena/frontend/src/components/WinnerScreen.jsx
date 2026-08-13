import { useEffect } from 'react'
import confetti from 'canvas-confetti'
import { motion } from 'framer-motion'

export default function WinnerScreen({ winner, rankings = [], onContinue }) {
  useEffect(() => {
    let raf = 0
    try {
      const end = Date.now() + 4500
      const frame = () => {
        try {
          confetti({
            particleCount: 5,
            angle: 60,
            spread: 60,
            origin: { x: 0, y: 0.7 },
            colors: ['#ffb703', '#ff5a36', '#4cc9f0', '#ff6b9d', '#06d6a0'],
          })
          confetti({
            particleCount: 5,
            angle: 120,
            spread: 60,
            origin: { x: 1, y: 0.7 },
            colors: ['#ffb703', '#ff5a36', '#4cc9f0', '#ff6b9d', '#06d6a0'],
          })
        } catch {
          return
        }
        if (Date.now() < end) raf = requestAnimationFrame(frame)
      }
      raf = requestAnimationFrame(frame)
    } catch {
      /* confetti optional */
    }
    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className="arena-bg relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 14 }}
        className="relative z-10 w-full max-w-2xl text-center"
      >
        <div className="bob mb-4 text-6xl md:text-8xl">🏆</div>
        <p className="font-display text-sm font-bold tracking-[0.3em] text-arena-accent md:text-base">
          VINH DANH
        </p>
        <h1 className="glow-gold mt-3 inline-block rounded-3xl bg-arena-gold px-6 py-2 font-display text-4xl font-bold text-arena-ink md:text-6xl">
          QUÁN QUÂN
        </h1>
        {winner ? (
          <>
            <motion.p
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-6 font-display text-3xl font-bold uppercase text-arena-accent md:text-5xl"
            >
              {winner.name}
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mt-4 font-display text-2xl font-bold text-arena-cyan md:text-4xl"
            >
              {winner.score} ĐIỂM
            </motion.p>
          </>
        ) : (
          <p className="mt-6 text-xl font-bold text-arena-ink/60">Chưa có người chiến thắng</p>
        )}
      </motion.div>

      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1 }}
        className="glass relative z-10 mt-10 w-full max-w-xl rounded-[2rem] p-6"
      >
        <h2 className="mb-4 text-center font-display text-lg font-bold text-arena-accent">
          🏆 BẢNG XẾP HẠNG
        </h2>
        <ul className="space-y-2">
          {rankings.map((p, i) => (
            <motion.li
              key={p.player_id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 1.1 + i * 0.08 }}
              className={`flex items-center justify-between rounded-2xl px-4 py-3 font-bold ${
                i === 0
                  ? 'bg-arena-gold/40'
                  : i === 1
                    ? 'bg-slate-100'
                    : i === 2
                      ? 'bg-orange-100'
                      : 'bg-arena-sky/15'
              }`}
            >
              <span className="text-arena-ink">
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${p.rank ?? i + 1}.`}{' '}
                {p.name}
              </span>
              <span className="font-display text-arena-cyan">{p.score} điểm</span>
            </motion.li>
          ))}
        </ul>
      </motion.div>

      {onContinue && (
        <button
          type="button"
          onClick={onContinue}
          className="relative z-10 mt-8 rounded-full bg-arena-accent px-8 py-3 font-black text-white shadow-[0_6px_0_#c43a1a]"
        >
          Tiếp tục
        </button>
      )}
    </div>
  )
}
