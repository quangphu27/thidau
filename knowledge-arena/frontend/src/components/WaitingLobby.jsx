import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

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

/** Even grid on the floor for students — leave center-front for host */
function slotPos(index, total) {
  if (total <= 0) return { x: 50, y: 72 }
  if (total === 1) return { x: 50, y: 74 }

  const rows = total <= 5 ? 1 : 2
  const topCount = rows === 1 ? total : Math.ceil(total / 2)
  const row = index < topCount ? 0 : 1
  const col = row === 0 ? index : index - topCount
  const inRow = row === 0 ? topCount : total - topCount
  const padX = 10
  const usable = 100 - padX * 2
  const x = padX + (usable * (col + 1)) / (inRow + 1)
  const y = rows === 1 ? 74 : row === 0 ? 64 : 84
  return { x: Math.round(x * 10) / 10, y }
}

const HOST_DEFAULT_POS = { x: 50, y: 46 }
const HOST_ID = 'admin'

/** Push overlapping points apart (percent space). `pinned` ids stay fixed. */
function separatePositions(entries, minDx = 11, minDy = 16, pinned = new Set()) {
  const pts = entries.map((e) => ({
    id: e.id,
    x: e.x,
    y: e.y,
  }))
  for (let iter = 0; iter < 12; iter++) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i]
        const b = pts[j]
        let dx = b.x - a.x
        let dy = (b.y - a.y) * 1.15
        const dist = Math.hypot(dx, dy) || 0.01
        const need = Math.hypot(minDx, minDy * 0.35)
        if (dist < need) {
          const push = ((need - dist) / 2) * 0.85
          const ux = dx / dist
          const uy = dy / dist
          const aPinned = pinned.has(a.id)
          const bPinned = pinned.has(b.id)
          if (aPinned && bPinned) continue
          if (aPinned) {
            b.x += ux * push * 2
            b.y += (uy * push * 2) / 1.15
          } else if (bPinned) {
            a.x -= ux * push * 2
            a.y -= (uy * push * 2) / 1.15
          } else {
            a.x -= ux * push
            a.y -= (uy * push) / 1.15
            b.x += ux * push
            b.y += (uy * push) / 1.15
          }
        }
      }
    }
  }
  return Object.fromEntries(
    pts.map((p) => [
      p.id,
      {
        x: Math.min(92, Math.max(8, p.x)),
        y: Math.min(88, Math.max(42, p.y)),
      },
    ]),
  )
}

function HostAvatar({
  name,
  pos,
  isMe,
  selected,
  pose,
  bubble,
  zBoost,
  onSelect,
}) {
  const hostPlayer = { player_id: HOST_ID, name }
  return (
    <motion.button
      type="button"
      className="absolute -translate-x-1/2 -translate-y-full cursor-pointer border-0 bg-transparent p-0 outline-none"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        zIndex: zBoost || 35,
      }}
      animate={{ left: `${pos.x}%`, top: `${pos.y}%` }}
      transition={{ type: 'spring', stiffness: 150, damping: 18 }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.(hostPlayer)
      }}
    >
      <AnimatePresence>
        {bubble && (
          <motion.div
            key={bubble}
            initial={{ opacity: 0, y: 8, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute bottom-full left-1/2 mb-2 w-max max-w-[16rem] -translate-x-1/2 rounded-2xl border-2 border-arena-gold bg-white px-3.5 py-2.5 text-left text-sm font-extrabold leading-snug text-arena-ink shadow-lg md:text-base"
          >
            {bubble}
            <span className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[7px] border-x-transparent border-t-white" />
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={`lobby-host relative flex flex-col items-center ${
          pose === 'hit'
            ? 'lobby-hit'
            : pose === 'throw'
              ? 'lobby-throw'
              : pose === 'charge'
                ? 'lobby-charge'
                : pose === 'brawl'
                  ? 'lobby-brawl'
                  : 'lobby-host-idle'
        } ${selected ? 'scale-110' : ''}`}
      >
        {/* Aura */}
        <div className="lobby-host-aura pointer-events-none absolute -inset-3 rounded-full" />

        <span className="relative z-[1] mb-0.5 rounded-full bg-gradient-to-r from-arena-gold to-arena-accent px-2 py-0.5 text-[9px] font-black text-white shadow md:text-[10px]">
          {isMe ? 'BẠN · ADMIN' : '⭐ ADMIN'}
        </span>

        {/* Crown */}
        <div className="relative z-[2] -mb-1 text-2xl drop-shadow md:text-3xl">👑</div>

        {/* Head */}
        <div
          className={`relative z-[2] flex h-14 w-14 items-center justify-center rounded-full border-4 border-arena-gold text-3xl shadow-[0_0_18px_rgba(255,183,3,0.65)] md:h-16 md:w-16 md:text-4xl ${
            selected ? 'ring-4 ring-white' : ''
          }`}
          style={{
            background: 'linear-gradient(145deg, #1b3a4b 0%, #023e8a 55%, #0077b6 100%)',
          }}
        >
          {pose === 'hit' ? '😵' : pose === 'charge' || pose === 'brawl' ? '🔥' : pose === 'throw' ? '😎' : '🕶️'}
        </div>

        {/* Cape */}
        <div className="lobby-host-cape pointer-events-none absolute top-[52%] -z-0 h-14 w-16 rounded-b-full bg-gradient-to-b from-arena-accent to-red-800 opacity-90 md:h-16 md:w-20" />

        {/* Body armor */}
        <div
          className="relative z-[2] -mt-1 h-12 w-11 rounded-2xl border-4 border-arena-gold shadow-md md:h-14 md:w-12"
          style={{
            background: 'linear-gradient(180deg, #ffb703 0%, #fb8500 45%, #c43a1a 100%)',
          }}
        >
          <span className="absolute inset-0 flex items-center justify-center text-lg md:text-xl">⚡</span>
        </div>

        <div className="relative z-[2] mt-0.5 flex gap-1.5">
          <div className="h-4 w-2.5 rounded-full bg-[#023e8a]" />
          <div className="h-4 w-2.5 rounded-full bg-[#023e8a]" />
        </div>

        <p
          className="relative z-[2] mt-1 max-w-[7.5rem] truncate text-center text-xs font-black text-arena-ink drop-shadow-sm md:max-w-[9rem] md:text-sm"
          title={name}
        >
          {name}
        </p>
      </div>
    </motion.button>
  )
}

function LobbyAvatar({
  player,
  skin,
  pos,
  isMe,
  selected,
  pose,
  bubble,
  zBoost,
  onSelect,
}) {
  return (
    <motion.button
      type="button"
      className="absolute -translate-x-1/2 -translate-y-full cursor-pointer border-0 bg-transparent p-0 outline-none"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        zIndex: zBoost || 10 + Math.round(pos.y),
      }}
      animate={{ left: `${pos.x}%`, top: `${pos.y}%` }}
      transition={{ type: 'spring', stiffness: 160, damping: 20 }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.(player)
      }}
    >
      <AnimatePresence>
        {bubble && (
          <motion.div
            key={bubble}
            initial={{ opacity: 0, y: 8, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute bottom-full left-1/2 mb-2 w-max max-w-[14rem] -translate-x-1/2 rounded-2xl bg-white px-3.5 py-2.5 text-left text-sm font-extrabold leading-snug text-arena-ink shadow-lg md:max-w-[16rem] md:text-base"
          >
            {bubble}
            <span className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[7px] border-x-transparent border-t-white" />
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={`relative flex flex-col items-center ${
          pose === 'hit'
            ? 'lobby-hit'
            : pose === 'throw'
              ? 'lobby-throw'
              : pose === 'charge'
                ? 'lobby-charge'
                : pose === 'brawl'
                  ? 'lobby-brawl'
                  : 'lobby-idle'
        } ${selected ? 'scale-110' : ''}`}
      >
        {isMe && (
          <span className="mb-0.5 rounded-full bg-arena-accent px-1.5 text-[9px] font-black text-white">
            BẠN
          </span>
        )}
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-full border-4 border-white text-xl shadow-md md:h-14 md:w-14 md:text-2xl ${
            selected ? 'ring-4 ring-arena-gold' : ''
          }`}
          style={{ background: skin.body }}
        >
          {pose === 'hit'
            ? '😵'
            : pose === 'charge' || pose === 'brawl'
              ? '😤'
              : pose === 'throw'
                ? '😆'
                : skin.emoji}
        </div>
        <div
          className="mt-[-3px] h-9 w-8 rounded-2xl border-4 border-white shadow-md md:h-11 md:w-9"
          style={{ background: skin.accent }}
        />
        <div className="mt-0.5 flex gap-1">
          <div className="h-3 w-2 rounded-full" style={{ background: skin.accent }} />
          <div className="h-3 w-2 rounded-full" style={{ background: skin.accent }} />
        </div>
        <p
          className={`mt-1 max-w-[4.8rem] truncate text-center text-[10px] font-extrabold md:text-xs ${
            isMe ? 'text-arena-accent' : 'text-arena-ink'
          }`}
          title={player.name}
        >
          {player.name}
        </p>
      </div>
    </motion.button>
  )
}

/**
 * Game-style waiting hall: characters share a floor, chat bubbles, move & fight.
 */
export default function WaitingLobby({
  roomCode,
  players = [],
  myPlayerId = null,
  myName = '',
  hostName = 'Thầy Phú Anex',
  isAdmin = false,
  messages = [],
  lobbyFx = null,
  positions = {},
  onSendChat,
  onAnnounce,
  onAction,
  onMove,
  onClearFx,
}) {
  const [text, setText] = useState('')
  const [announce, setAnnounce] = useState('')
  const [targetId, setTargetId] = useState('')
  const [bubbles, setBubbles] = useState({})
  const [poses, setPoses] = useState({})
  const [chargePos, setChargePos] = useState(null) // { id, x, y } temporary
  const [hallAnnounce, setHallAnnounce] = useState(null)
  const [fxGeo, setFxGeo] = useState(null) // snapshot so walks don't warp FX
  const hallRef = useRef(null)
  const listRef = useRef(null)
  const restingPosRef = useRef({})
  const lastMoveAtRef = useRef(0)
  const moveTimerRef = useRef(null)

  const hostBase = useMemo(
    () => positions[HOST_ID] || HOST_DEFAULT_POS,
    [positions],
  )

  const hostPos = useMemo(() => {
    if (chargePos?.id === HOST_ID) return { x: chargePos.x, y: chargePos.y }
    return hostBase
  }, [chargePos, hostBase])

  const roster = useMemo(() => {
    const raw = (players || []).map((p, i) => {
      const fallback = slotPos(i, players.length)
      const live = positions[p.player_id]
      return {
        ...p,
        base: live ? { x: live.x, y: live.y } : fallback,
        skin: SKINS[i % SKINS.length],
      }
    })
    const separated = separatePositions(
      [
        { id: HOST_ID, x: hostBase.x, y: hostBase.y },
        ...raw.map((p) => ({ id: p.player_id, x: p.base.x, y: p.base.y })),
      ],
      11,
      16,
      new Set([HOST_ID]),
    )
    return raw.map((p) => {
      let pos = separated[p.player_id] || p.base
      if (chargePos?.id === p.player_id) {
        pos = { x: chargePos.x, y: chargePos.y }
      }
      return { ...p, pos }
    })
  }, [players, positions, chargePos, hostBase])

  const restingPos = useMemo(() => {
    const raw = (players || []).map((p, i) => {
      const fallback = slotPos(i, players.length)
      const live = positions[p.player_id]
      return { id: p.player_id, ...(live || fallback) }
    })
    const sep = separatePositions(
      [{ id: HOST_ID, x: hostBase.x, y: hostBase.y }, ...raw],
      11,
      16,
      new Set([HOST_ID]),
    )
    return { ...sep, [HOST_ID]: hostBase }
  }, [players, positions, hostBase])

  restingPosRef.current = restingPos

  // Drop target if that student left the room
  useEffect(() => {
    if (!targetId || targetId === HOST_ID) return
    if (!(players || []).some((p) => p.player_id === targetId)) {
      setTargetId('')
    }
  }, [players, targetId])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages.length])

  useEffect(() => {
    const last = messages[messages.length - 1]
    if (!last) return undefined
    if (last.type === 'lobby_announce') {
      setHallAnnounce({ text: last.text, id: last.id || last.at })
      const t = setTimeout(() => setHallAnnounce(null), 6000)
      return () => clearTimeout(t)
    }
    const pid =
      last.type === 'lobby_chat'
        ? last.player_id
        : last.type === 'lobby_action'
          ? last.from_id
          : null
    if (!pid) return undefined
    const label =
      last.type === 'lobby_action'
        ? last.action === 'brick'
          ? '🧱!'
          : '💥!'
        : last.text
    setBubbles((prev) => ({ ...prev, [pid]: label }))
    const t = setTimeout(() => {
      setBubbles((prev) => {
        const next = { ...prev }
        if (next[pid] === label) delete next[pid]
        return next
      })
    }, 3200)
    return () => clearTimeout(t)
  }, [messages])

  // Brick / brawl FX — only re-run when a new FX event arrives (not when someone walks)
  useEffect(() => {
    if (!lobbyFx?.at) {
      setFxGeo(null)
      return undefined
    }
    const from = lobbyFx.from_id
    const to = lobbyFx.target_id
    const fxKey = lobbyFx.id || lobbyFx.at
    const resting = restingPosRef.current
    const fromRest = from
      ? resting[from] || (from === HOST_ID ? HOST_DEFAULT_POS : { x: 30, y: 60 })
      : HOST_DEFAULT_POS
    const toRest = to
      ? resting[to] || (to === HOST_ID ? HOST_DEFAULT_POS : { x: 70, y: 65 })
      : null

    if (lobbyFx.action === 'brick' && toRest) {
      setChargePos(null)
      setFxGeo({ key: fxKey, brick: { from: fromRest, to: toRest } })
      if (from) setPoses((p) => ({ ...p, [from]: 'throw' }))
      if (to) setPoses((p) => ({ ...p, [to]: 'hit' }))
      const t1 = setTimeout(() => setPoses({}), 1200)
      const t2 = setTimeout(() => onClearFx?.(), 1400)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }

    if (lobbyFx.action === 'brawl' && toRest && from) {
      const mid = {
        x: fromRest.x + (toRest.x - fromRest.x) * 0.82,
        y: fromRest.y + (toRest.y - fromRest.y) * 0.82,
      }
      setFxGeo({
        key: fxKey,
        impact: {
          x: fromRest.x + (toRest.x - fromRest.x) * 0.75,
          y: fromRest.y + (toRest.y - fromRest.y) * 0.75,
          fromName: lobbyFx.from_name,
          toName: lobbyFx.target_name,
        },
      })
      setPoses((p) => ({ ...p, [from]: 'charge' }))
      setChargePos({ id: from, x: mid.x, y: mid.y })
      const tHit = setTimeout(() => {
        setPoses((p) => ({
          ...p,
          [from]: 'brawl',
          [to]: 'hit',
        }))
      }, 380)
      const tReset = setTimeout(() => {
        setChargePos(null)
        setPoses({})
      }, 1300)
      const tClear = setTimeout(() => onClearFx?.(), 1500)
      return () => {
        clearTimeout(tHit)
        clearTimeout(tReset)
        clearTimeout(tClear)
        setChargePos(null)
      }
    }

    const t = setTimeout(() => onClearFx?.(), 1200)
    return () => clearTimeout(t)
  }, [
    lobbyFx?.at,
    lobbyFx?.id,
    lobbyFx?.action,
    lobbyFx?.from_id,
    lobbyFx?.target_id,
    lobbyFx?.from_name,
    lobbyFx?.target_name,
    onClearFx,
  ])

  const brickFlight = fxGeo?.brick ? { ...fxGeo.brick, key: fxGeo.key } : null
  const brawlImpact = fxGeo?.impact ? { ...fxGeo.impact, key: fxGeo.key } : null

  const submitChat = (e) => {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    onSendChat?.(t)
    setText('')
  }

  const submitAnnounce = (e) => {
    e.preventDefault()
    const t = announce.trim()
    if (!t) return
    onAnnounce?.(t)
    setAnnounce('')
  }

  useEffect(
    () => () => {
      if (moveTimerRef.current) clearTimeout(moveTimerRef.current)
    },
    [],
  )

  const onHallClick = (e) => {
    if (!onMove || !hallRef.current) return
    const rect = hallRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    const minY = isAdmin ? 40 : 44
    if (y < minY - 4) return
    const next = {
      x: Math.min(90, Math.max(10, x)),
      y: Math.min(86, Math.max(minY, y)),
    }
    const now = Date.now()
    if (now - lastMoveAtRef.current < 100) {
      if (moveTimerRef.current) clearTimeout(moveTimerRef.current)
      moveTimerRef.current = setTimeout(() => {
        lastMoveAtRef.current = Date.now()
        onMove(next)
      }, 100)
      return
    }
    lastMoveAtRef.current = now
    onMove(next)
  }

  const targetLabel =
    targetId === HOST_ID
      ? hostName || 'Thầy Phú Anex'
      : players.find((p) => p.player_id === targetId)?.name || '...'

  return (
    <div className="space-y-3">
      <div className="rounded-[1.5rem] border-4 border-white bg-gradient-to-r from-arena-gold via-orange-300 to-arena-accent px-4 py-3 text-center shadow-lg md:py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/85 md:text-xs">
          Đấu Trường Kiến Thức
        </p>
        <h2 className="font-display text-2xl font-black text-white drop-shadow md:text-4xl">
          {hostName || 'Thầy Phú Anex'}
        </h2>
        <p className="mt-0.5 text-sm font-extrabold text-white/90">
          Phòng {roomCode?.toUpperCase()} · {players.length} chiến binh đang chờ
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2 px-1">
        <p className="text-sm font-bold text-arena-ink/55">
          {isAdmin
            ? 'Bạn là nhân vật Admin · click sàn để đi · click học sinh = ném gạch'
            : 'Click sàn để đi · click thầy/bạn = ném gạch · nút Solo kill để lao vào'}
        </p>
        <p className="animate-pulse text-sm font-extrabold text-arena-cyan">
          Đang chờ cô/thầy bắt đầu...
        </p>
      </div>

      <div
        ref={hallRef}
        onClick={onHallClick}
        className="lobby-hall relative h-[340px] overflow-hidden rounded-[2rem] border-4 border-white shadow-xl md:h-[420px]"
      >
        <div className="lobby-hall-bg pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] bg-gradient-to-b from-black/10 to-transparent px-4 py-3 text-center">
          <p className="font-display text-sm font-black text-white drop-shadow md:text-base">
            SẢNH CỦA { (hostName || 'Thầy Phú Anex').toUpperCase() }
          </p>
        </div>

        <AnimatePresence>
          {hallAnnounce && (
            <motion.div
              key={hallAnnounce.id || hallAnnounce.text}
              className="pointer-events-none absolute inset-x-3 top-14 z-40 md:inset-x-8 md:top-16"
              initial={{ opacity: 0, y: -24, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <div className="rounded-3xl border-4 border-white bg-gradient-to-r from-arena-gold via-orange-400 to-arena-accent px-4 py-4 text-center shadow-2xl md:px-8 md:py-5">
                <p className="font-display text-xs font-black uppercase tracking-widest text-white/90 md:text-sm">
                  📢 Thông báo từ Admin
                </p>
                <p className="mt-1 font-display text-xl font-black leading-snug text-white drop-shadow md:text-3xl md:leading-tight">
                  {hallAnnounce.text}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className="pointer-events-none absolute z-[2] h-2.5 w-12 -translate-x-1/2 rounded-full bg-black/20"
          style={{ left: `${hostPos.x}%`, top: `${hostPos.y}%` }}
        />
        {roster.map((p) => (
          <div
            key={`shadow-${p.player_id}`}
            className="pointer-events-none absolute z-[2] h-2 w-10 -translate-x-1/2 rounded-full bg-black/15"
            style={{ left: `${p.pos.x}%`, top: `${p.pos.y}%` }}
          />
        ))}

        <HostAvatar
          name={hostName || 'Thầy Phú Anex'}
          pos={hostPos}
          isMe={isAdmin}
          selected={targetId === HOST_ID}
          pose={poses[HOST_ID] || 'idle'}
          zBoost={chargePos?.id === HOST_ID ? 45 : 35}
          bubble={bubbles[HOST_ID]}
          onSelect={(pl) => {
            if (isAdmin) return
            setTargetId(pl.player_id)
            onAction?.('brick', pl.player_id)
          }}
        />

        {roster.map((p) => (
          <LobbyAvatar
            key={p.player_id}
            player={p}
            skin={p.skin}
            pos={p.pos}
            isMe={!isAdmin && p.player_id === myPlayerId}
            selected={targetId === p.player_id}
            pose={poses[p.player_id] || 'idle'}
            zBoost={chargePos?.id === p.player_id ? 40 : undefined}
            bubble={bubbles[p.player_id]}
            onSelect={(pl) => {
              if (!isAdmin && pl.player_id === myPlayerId) return
              setTargetId(pl.player_id)
              onAction?.('brick', pl.player_id)
            }}
          />
        ))}

        {!roster.length && (
          <p className="pointer-events-none absolute inset-x-0 bottom-8 z-10 text-center font-bold text-white/80">
            Đang chờ chiến binh vào sảnh...
          </p>
        )}

        <AnimatePresence>
          {brickFlight && (
            <motion.span
              key={brickFlight.key}
              className="pointer-events-none absolute z-30 text-3xl md:text-4xl"
              style={{ left: `${brickFlight.from.x}%`, top: `${brickFlight.from.y}%` }}
              initial={{ x: '-50%', y: '-120%', rotate: 0, scale: 0.7, opacity: 1 }}
              animate={{
                left: `${brickFlight.to.x}%`,
                top: `${brickFlight.to.y}%`,
                rotate: 320,
                scale: 1.15,
                opacity: 1,
              }}
              exit={{ opacity: 0, scale: 1.4 }}
              transition={{ duration: 0.65, ease: 'easeIn' }}
            >
              🧱
            </motion.span>
          )}

          {brawlImpact && (
            <motion.div
              key={`impact-${brawlImpact.key}`}
              className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${brawlImpact.x}%`, top: `${brawlImpact.y}%` }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <motion.span
                  key={i}
                  className="absolute text-2xl"
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                  animate={{
                    opacity: [0, 1, 0],
                    x: Math.cos((i / 6) * Math.PI * 2) * 36,
                    y: Math.sin((i / 6) * Math.PI * 2) * 28 - 10,
                    scale: [0.5, 1.3, 1],
                  }}
                  transition={{ duration: 0.85, delay: 0.32 + i * 0.03 }}
                >
                  {i % 2 ? '💨' : '☁️'}
                </motion.span>
              ))}
              <motion.p
                className="absolute left-1/2 top-8 w-max -translate-x-1/2 rounded-xl bg-arena-pink px-3 py-1 text-xs font-black text-white shadow"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                {brawlImpact.fromName} → {brawlImpact.toName}
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {targetId && (
          <div className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-full bg-arena-ink/75 px-3 py-1 text-xs font-bold text-white">
            Mục tiêu: {targetLabel}
          </div>
        )}
      </div>

      <div className="glass grid gap-3 rounded-[1.5rem] p-3 md:grid-cols-[1fr_auto] md:p-4">
        <div className="flex min-h-0 flex-col">
          <div
            ref={listRef}
            className="mb-2 max-h-24 space-y-1 overflow-y-auto rounded-xl bg-white/60 px-2 py-1.5 text-xs md:max-h-28"
          >
            {!messages.length && (
              <p className="py-2 text-center font-bold text-arena-ink/35">Chưa có chat...</p>
            )}
            {messages.slice(-30).map((m) => {
              const key = m.id || `${m.type}-${m.at}-${m.text}`
              if (m.type === 'lobby_announce') {
                return (
                  <p
                    key={key}
                    className="rounded-xl border-2 border-arena-gold bg-amber-100 px-2 py-2 text-sm font-black text-arena-ink md:text-base"
                  >
                    📢 <span className="text-arena-accent">Admin:</span> {m.text}
                  </p>
                )
              }
              if (m.type === 'lobby_action' || m.action) {
                return (
                  <p key={key} className="font-semibold text-arena-pink">
                    {m.text}
                  </p>
                )
              }
              return (
                <p key={key} className="font-semibold text-arena-ink/80">
                  <span className="text-arena-cyan">
                    {m.is_admin ? hostName || 'Admin' : m.player_name}:
                  </span>{' '}
                  {m.text}
                </p>
              )
            })}
          </div>
          <form onSubmit={submitChat} className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={200}
              placeholder={isAdmin ? 'Admin chat...' : 'Nói chuyện trong sảnh...'}
              className="min-w-0 flex-1 rounded-xl border-2 border-arena-sky/30 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-arena-cyan"
            />
            <button type="submit" className="rounded-xl bg-arena-cyan px-3 py-2 text-sm font-black text-white">
              Gửi
            </button>
          </form>
          {isAdmin && (
            <form onSubmit={submitAnnounce} className="mt-2 flex gap-2">
              <input
                value={announce}
                onChange={(e) => setAnnounce(e.target.value)}
                maxLength={300}
                placeholder="📢 Thông báo cả sảnh..."
                className="min-w-0 flex-1 rounded-xl border-2 border-arena-gold/50 bg-amber-50 px-3 py-2 text-sm font-semibold outline-none"
              />
              <button type="submit" className="rounded-xl bg-arena-gold px-3 py-2 text-sm font-black">
                Báo
              </button>
            </form>
          )}
        </div>

        <div className="flex flex-row gap-2 md:w-44 md:flex-col">
          <button
            type="button"
            disabled={isAdmin ? players.length < 1 : false}
            onClick={() => onAction?.('brick', targetId || null)}
            className="flex-1 rounded-xl bg-stone-600 px-3 py-3 text-sm font-black text-white disabled:opacity-40"
          >
            🧱 Ném gạch
          </button>
          <button
            type="button"
            disabled={isAdmin ? players.length < 1 : false}
            onClick={() => onAction?.('brawl', targetId || null)}
            className="flex-1 rounded-xl bg-arena-pink px-3 py-3 text-sm font-black text-white disabled:opacity-40"
          >
            💥 Solo kill
          </button>
          <p className="hidden text-[10px] font-semibold text-arena-ink/45 md:block">
            Click nhân vật = ném gạch ngay · chọn rồi bấm Solo kill để lao vào
          </p>
          {isAdmin ? (
            <p className="hidden text-center text-xs font-extrabold text-arena-gold md:block">
              {hostName || 'Thầy Phú Anex'}
            </p>
          ) : (
            myName && (
              <p className="hidden text-center text-xs font-extrabold text-arena-accent md:block">
                {myName}
              </p>
            )
          )}
        </div>
      </div>
    </div>
  )
}
