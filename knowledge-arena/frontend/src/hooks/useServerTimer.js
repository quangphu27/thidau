import { useEffect, useState } from 'react'

/**
 * Display countdown synced to server ends_at timestamp.
 */
export function useServerTimer(endsAt, paused = false) {
  const [remaining, setRemaining] = useState(null)

  useEffect(() => {
    if (!endsAt) {
      setRemaining(null)
      return undefined
    }
    const tick = () => {
      const end = new Date(endsAt).getTime()
      const now = Date.now()
      setRemaining(Math.max(0, (end - now) / 1000))
    }
    tick()
    if (paused) return undefined
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [endsAt, paused])

  return remaining
}
