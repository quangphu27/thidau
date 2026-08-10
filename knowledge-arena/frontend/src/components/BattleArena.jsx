import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SKINS = [
  { body: '#4cc9f0', accent: '#0077b6', emoji: '🦊' },
  { body: '#ff6b9d', accent: '#c9184a', emoji: '🐰' },
  { body: '#ffb703', accent: '#fb8500', emoji: '🐯' },
  { body: '#06d6a0', accent: '#049a72', emoji: '🐸' },
  { body: '#9b5de5', accent: '#5a189a', emoji: '🦄' },
  { body: '#ff5a36', accent: '#c43a1a', emoji: '🦁' },
  { body: '#48cae4', accent: '#023e8a', emoji: '🐼' },
  { body: '#f72585', accent: '#7209b7', emoji: '🐨' },
]

function DustCloud({ active, burstKey = 0 }) {
  if (!active) return null
  const puffs = [
    { x: -18, y: -8, s: 1.1, d: 0 },
    { x: 12, y: -14, s: 1.35, d: 0.08 },
    { x: 0, y: 6, s: 1.5, d: 0.12 },
    { x: -8, y: -20, s: 0.9, d: 0.18 },
    { x: 22, y: 2, s: 1.05, d: 0.05 },
  ]
  return (
    <div key={`dust-${burstKey}`} className="pointer-events-none absolute inset-0 z-30 overflow-visible">
      {puffs.map((p, i) => (
        <motion.span
          key={i}
          className="absolute left-1/2 top-1/2 block rounded-full bg-gradient-to-br from-stone-300/95 via-amber-100/80 to-stone-400/70 shadow-sm"
          style={{
            width: `${22 * p.s}px`,
            height: `${16 * p.s}px`,
            marginLeft: -11 * p.s,
            marginTop: -8 * p.s,
            filter: 'blur(0.4px)',
          }}
          initial={{ opacity: 0, scale: 0.2, x: 0, y: 0 }}
          animate={{
            opacity: [0, 1, 0.85, 0],
            scale: [0.3, 1.2, 1.6],
            x: [0, p.x * 1.2, p.x * 1.8],
            y: [0, p.y, p.y - 10],
          }}
          transition={{ duration: 0.95, delay: p.d, ease: 'easeOut' }}
        />
      ))}
      <motion.span
        className="absolute left-1/2 top-0 text-2xl"
        initial={{ opacity: 0, scale: 0.4, y: 10 }}
        animate={{ opacity: [0, 1, 0], scale: [0.6, 1.3, 1.5], y: [-4, -28] }}
        transition={{ duration: 0.9 }}
      >
        ☁️
      </motion.span>
      <motion.span
        className="absolute left-[20%] top-2 text-xl"
        initial={{ opacity: 0, x: 0 }}
        animate={{ opacity: [0, 1, 0], x: [-16, -28], y: [-6, -18] }}
        transition={{ duration: 0.85, delay: 0.1 }}
      >
        💨
      </motion.span>
      <motion.span
        className="absolute right-[15%] top-3 text-xl"
        initial={{ opacity: 0, x: 0 }}
        animate={{ opacity: [0, 1, 0], x: [14, 26], y: [-4, -16] }}
        transition={{ duration: 0.85, delay: 0.15 }}
      >
        💨
      </motion.span>
    </div>
  )
}

function Fighter({ fighter, index, isMe, large, showDust, spotlight, attackPulse }) {
  const skin = SKINS[index % SKINS.length]
  const status = fighter.status || 'standing'
  const size = large ? 'w-20 h-28 md:w-24 md:h-32' : 'w-14 h-20 sm:w-16 sm:h-24'

  return (
    <motion.div
      layout
      className={`relative flex flex-col items-center ${size} ${
        spotlight ? 'z-10' : ''
      }`}
      initial={{ opacity: 0, y: 20 }}
      animate={{
        opacity: status === 'fallen' && !showDust ? 0.55 : 1,
        y: 0,
        scale: spotlight ? 1.12 : 1,
      }}
      transition={{ type: 'spring', stiffness: 200, damping: 18 }}
    >
      <AnimatePresence>
        {status === 'attacking' && (
          <motion.div
            key={`slash-${attackPulse || 0}`}
            className="pointer-events-none absolute -right-5 top-1 z-20 text-2xl md:text-3xl"
            initial={{ scale: 0.2, opacity: 0, x: 0 }}
            animate={{ scale: [0.6, 1.3, 1], opacity: [0, 1, 0], x: [0, 22, 36], y: [0, -6, -4] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            💨
          </motion.div>
        )}
        {(status === 'hit' || showDust) && (
          <motion.div
            key={`hit-${attackPulse || 0}-${fighter.player_id}`}
            className="pointer-events-none absolute -top-4 left-1/2 z-20 -translate-x-1/2 text-2xl"
            initial={{ scale: 0, y: 0 }}
            animate={{ scale: [0.5, 1.3, 1], y: -12 }}
            exit={{ opacity: 0 }}
          >
            💫
          </motion.div>
        )}
      </AnimatePresence>

      <DustCloud
        active={showDust || status === 'hit'}
        burstKey={showDust ? `${attackPulse}-${fighter.player_id}` : status}
      />

      <motion.div
        key={status === 'attacking' ? `atk-${attackPulse || 0}` : `body-${status}`}
        className={`fighter-body relative flex flex-col items-center ${
          status === 'fallen' || status === 'falling' ? 'fighter-fallen' : ''
        } ${status === 'attacking' ? 'fighter-attack' : ''} ${
          status === 'hit' ? 'fighter-hit' : ''
        } ${status === 'standing' ? 'fighter-idle' : ''}`}
        style={{ transformOrigin: '50% 90%' }}
      >
        <div
          className={`relative z-10 flex items-center justify-center rounded-full border-4 border-white shadow-md ${
            large ? 'h-12 w-12 text-2xl md:h-14 md:w-14 md:text-3xl' : 'h-9 w-9 text-lg sm:h-10 sm:w-10'
          }`}
          style={{ background: skin.body }}
        >
          {status === 'fallen' || status === 'falling' || status === 'hit'
            ? '😵'
            : status === 'attacking'
              ? '😤'
              : skin.emoji}
        </div>
        <div
          className={`-mt-1 rounded-2xl border-4 border-white shadow-md ${
            large ? 'h-12 w-10 md:h-14 md:w-12' : 'h-9 w-7 sm:h-10 sm:w-8'
          }`}
          style={{ background: skin.accent }}
        />
        {(status === 'standing' || status === 'attacking') && (
          <div className="mt-0.5 flex gap-1">
            <div
              className={`rounded-full ${large ? 'h-5 w-2.5' : 'h-4 w-2'}`}
              style={{ background: skin.accent }}
            />
            <div
              className={`rounded-full ${large ? 'h-5 w-2.5' : 'h-4 w-2'}`}
              style={{ background: skin.accent }}
            />
          </div>
        )}
        {isMe && status === 'standing' && (
          <span className="absolute -top-3 rounded-full bg-arena-accent px-1.5 text-[9px] font-black text-white">
            BẠN
          </span>
        )}
      </motion.div>

      <p
        className={`mt-1 max-w-[4.5rem] truncate text-center font-extrabold leading-tight text-arena-ink ${
          large ? 'text-xs md:text-sm' : 'text-[10px] sm:text-xs'
        } ${status === 'fallen' ? 'opacity-50 line-through' : ''}`}
        title={fighter.name}
      >
        {fighter.name}
      </p>
      {typeof fighter.score === 'number' && (
        <p className="font-display text-[10px] font-bold text-arena-cyan sm:text-xs">
          {fighter.score}
        </p>
      )}
    </motion.div>
  )
}

/**
 * Battle arena — mỗi học sinh là 1 chiến binh.
 * standing | falling | fallen | attacking | hit
 */
export default function BattleArena({
  players = [],
  fighterStatus = {},
  myPlayerId = null,
  large = false,
  banner = null,
  dustBurst = null,
  zoomed = false,
  attackPulse = 0,
}) {
  const fighters = useMemo(() => {
    return (players || []).map((p) => ({
      ...p,
      status: fighterStatus[p.player_id] || 'standing',
    }))
  }, [players, fighterStatus])

  const dustSet = useMemo(() => new Set(dustBurst?.victims || []), [dustBurst])

  if (!fighters.length) {
    return (
      <div className="battle-ground glass rounded-[2rem] px-4 py-6 text-center">
        <p className="font-bold text-arena-ink/50">Chưa có chiến binh nào...</p>
      </div>
    )
  }

  return (
    <motion.div
      layout
      className={`battle-ground glass relative overflow-hidden rounded-[2rem] px-3 py-4 md:px-5 md:py-5 ${
        zoomed ? 'battle-zoom-active z-20 ring-4 ring-arena-gold/80 shadow-2xl' : ''
      }`}
      animate={{
        scale: zoomed ? (large ? 1.12 : 1.22) : 1,
        y: zoomed ? (large ? -8 : -12) : 0,
      }}
      transition={{ type: 'spring', stiffness: 160, damping: 18 }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-display text-xs font-bold text-arena-accent md:text-sm">
          🏟️ ĐẤU TRƯỜNG
        </p>
        <p className="text-[10px] font-bold text-arena-ink/45 md:text-xs">
          {fighters.filter((f) => f.status === 'standing' || f.status === 'attacking').length}/
          {fighters.length} đang chiến
        </p>
      </div>

      <AnimatePresence>
        {banner && (
          <motion.div
            key={banner}
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className={`mb-3 rounded-2xl px-3 py-2 text-center font-black text-white shadow-md ${
              zoomed
                ? 'bg-gradient-to-r from-arena-accent to-arena-pink text-base md:text-xl'
                : 'bg-arena-accent text-sm md:text-base'
            }`}
          >
            {banner}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={`battle-floor relative flex flex-wrap items-end justify-center gap-2 pt-2 sm:gap-3 md:gap-4 ${
          zoomed
            ? 'min-h-[10rem] gap-3 sm:gap-4 md:min-h-[12rem] md:gap-6'
            : 'min-h-[7.5rem] md:min-h-[9rem]'
        }`}
      >
        {fighters.map((f, i) => (
          <Fighter
            key={f.player_id}
            fighter={f}
            index={i}
            isMe={f.player_id === myPlayerId}
            large={large || zoomed}
            showDust={dustSet.has(f.player_id)}
            spotlight={zoomed && (f.status === 'attacking' || dustSet.has(f.player_id))}
            attackPulse={attackPulse}
          />
        ))}
      </div>
    </motion.div>
  )
}
