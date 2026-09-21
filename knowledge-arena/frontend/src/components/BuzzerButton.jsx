import { motion } from 'framer-motion'

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

export default function BuzzerButton({
  visible,
  x = 50,
  y = 50,
  disabled = false,
  claimed = false,
  claimerName = '',
  answerLeft = null,
  answerExpired = false,
  onBuzz,
  /** When true, position inside parent (right empty column) — never overlays question text */
  inLane = false,
}) {
  if (claimed) {
    const claimedCard = (
      <div className="flex h-full w-full flex-col items-center justify-center rounded-[1.25rem] border-4 border-arena-gold bg-white/95 px-3 py-4 text-center shadow-xl">
        <p className="font-display text-[10px] font-bold tracking-widest text-arena-accent">
          QUYỀN TRẢ LỜI
        </p>
        <p className="mt-1 font-display text-lg font-black uppercase text-arena-ink sm:text-xl">
          {claimerName || '...'}
        </p>
        {answerLeft != null && !answerExpired ? (
          <p
            className={`mt-2 font-display text-3xl font-black ${
              answerLeft <= 3 ? 'text-arena-red' : 'text-arena-cyan'
            }`}
          >
            {Math.ceil(answerLeft)}s
          </p>
        ) : null}
        <p className="mt-1 text-[11px] font-bold text-arena-ink/50">
          {answerExpired
            ? 'Hết giờ — chờ admin chấm'
            : 'Nói miệng — admin chấm Đúng/Sai'}
        </p>
      </div>
    )

    if (inLane) {
      return (
        <div className="pointer-events-none absolute inset-1 z-20 flex items-center justify-center">
          {claimedCard}
        </div>
      )
    }

    return (
      <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">{claimedCard}</div>
      </div>
    )
  }

  if (!visible) return null

  let ny = Number(y)
  if (!Number.isFinite(ny)) ny = 50
  // Centered in lane; only travel up/down (symmetric around 50%)
  const travelSec = 2.6 + (clamp(ny, 0, 100) / 100) * 1.4

  const bell = (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onBuzz}
      initial={{ top: '50%', x: '-50%', y: '-50%' }}
      animate={{ top: ['18%', '82%', '18%'], x: '-50%', y: '-50%' }}
      transition={{
        duration: travelSec,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={`pointer-events-auto absolute left-1/2 rounded-full border-4 border-white bg-gradient-to-br from-rose-500 to-orange-500 px-4 py-4 font-display text-sm font-black text-white shadow-[0_8px_0_#9f1239] sm:px-5 sm:py-5 sm:text-base ${
        disabled
          ? 'cursor-not-allowed opacity-40 grayscale'
          : 'cursor-pointer hover:scale-105 active:shadow-[0_3px_0_#9f1239]'
      }`}
      aria-label="Nhấn chuông"
    >
      🔔 CHUÔNG
    </motion.button>
  )

  if (inLane) {
    return (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-full w-full">{bell}</div>
      </div>
    )
  }

  return (
    <div className="pointer-events-none fixed bottom-24 top-28 right-2 z-40 w-[140px] sm:w-[160px]">
      <div className="relative h-full w-full">{bell}</div>
    </div>
  )
}
