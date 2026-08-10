import { useCallback, useEffect, useRef, useState } from 'react'

/** Keep in sync with backend GameService.correct_effect_ms */
export const CORRECT_ZOOM_MS = 600
export const CORRECT_PER_KILL_MS = 800
/** Pause after last túi bụi before countdown starts */
export const CORRECT_SETTLE_MS = 1000

/**
 * Quản lý trạng thái chiến đấu của từng học sinh.
 * standing → falling → fallen (sai)
 * standing → zoom + Solo kill từng người → countdown (đúng)
 */
export function useBattleFighters(players = [], questionId = null) {
  const [fighterStatus, setFighterStatus] = useState({})
  const [banner, setBanner] = useState(null)
  const [dustBurst, setDustBurst] = useState(null) // { at, victims }
  const [arenaZoom, setArenaZoom] = useState(false)
  const [attackPulse, setAttackPulse] = useState(0)
  const timers = useRef([])

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  const later = (fn, ms) => {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
  }

  // Reset mỗi câu hỏi mới
  useEffect(() => {
    clearTimers()
    setBanner(null)
    setDustBurst(null)
    setArenaZoom(false)
    setAttackPulse(0)
    const next = {}
    ;(players || []).forEach((p) => {
      next[p.player_id] = 'standing'
    })
    setFighterStatus(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId])

  // Đồng bộ player mới vào hàng (đứng)
  useEffect(() => {
    setFighterStatus((prev) => {
      const next = { ...prev }
      let changed = false
      ;(players || []).forEach((p) => {
        if (!next[p.player_id]) {
          next[p.player_id] = 'standing'
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [players])

  useEffect(() => () => clearTimers(), [])

  const knockDown = useCallback((playerId, name) => {
    if (!playerId) return
    setFighterStatus((prev) => {
      if (prev[playerId] === 'fallen' || prev[playerId] === 'falling') return prev
      return { ...prev, [playerId]: 'falling' }
    })
    setBanner(`${name || 'Một bạn'} trả lời SAI — ngã xuống!`)
    later(() => {
      setFighterStatus((prev) => ({ ...prev, [playerId]: 'fallen' }))
    }, 700)
    later(() => setBanner(null), 2200)
  }, [])

  /**
   * Zoom arena → Solo kill từng đối thủ → settle → onEffectDone (rồi mới countdown).
   */
  const victoryAttack = useCallback((attackerId, attackerName, allPlayers, onEffectDone) => {
    if (!attackerId) return
    clearTimers()

    const victims = (allPlayers || [])
      .map((p) => ({ id: p.player_id, name: p.name }))
      .filter((p) => p.id && p.id !== attackerId)

    setArenaZoom(true)
    setBanner(`${attackerName || 'Chiến binh'} trả lời ĐÚNG — Solo kill!`)
    setFighterStatus((prev) => ({ ...prev, [attackerId]: 'attacking' }))
    setDustBurst(null)

    if (!victims.length) {
      later(() => {
        setBanner(`${attackerName} độc chiếm đấu trường!`)
        setFighterStatus((prev) => ({ ...prev, [attackerId]: 'standing' }))
      }, CORRECT_ZOOM_MS + 400)
      later(() => {
        setArenaZoom(false)
        setBanner(null)
        setDustBurst(null)
        onEffectDone?.()
      }, CORRECT_ZOOM_MS + 700 + CORRECT_SETTLE_MS)
      return
    }

    victims.forEach((victim, i) => {
      const t0 = CORRECT_ZOOM_MS + i * CORRECT_PER_KILL_MS

      // Lao vào / Solo kill victim này
      later(() => {
        setBanner(`${attackerName} Solo kill ${victim.name}!`)
        setAttackPulse((n) => n + 1)
        setFighterStatus((prev) => ({
          ...prev,
          [attackerId]: 'attacking',
          [victim.id]: 'hit',
        }))
        setDustBurst({ at: Date.now(), victims: [victim.id] })
      }, t0)

      // Ngã sau túi bụi
      later(() => {
        setFighterStatus((prev) => ({
          ...prev,
          [victim.id]: 'fallen',
          [attackerId]: 'attacking',
        }))
        setDustBurst(null)
      }, t0 + 520)
    })

    const totalFx =
      CORRECT_ZOOM_MS + victims.length * CORRECT_PER_KILL_MS + CORRECT_SETTLE_MS

    later(() => {
      setFighterStatus((prev) => ({ ...prev, [attackerId]: 'standing' }))
      setBanner(`${attackerName} quét sạch đấu trường!`)
    }, totalFx - CORRECT_SETTLE_MS)

    later(() => {
      setArenaZoom(false)
      setBanner(null)
      setDustBurst(null)
      onEffectDone?.()
    }, totalFx)
  }, [])

  return { fighterStatus, banner, dustBurst, arenaZoom, attackPulse, knockDown, victoryAttack }
}
