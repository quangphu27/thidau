import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useRoomSocket } from '../hooks/useRoomSocket'
import { useServerTimer } from '../hooks/useServerTimer'
import { useBattleFighters } from '../hooks/useBattleFighters'
import AnswerToast from '../components/AnswerToast'
import BattleArena from '../components/BattleArena'
import NextQuestionCountdown from '../components/NextQuestionCountdown'
import WinnerScreen from '../components/WinnerScreen'
import MediaPlayer from '../components/MediaPlayer'

export default function PresentationPage() {
  const { code } = useParams()
  const { roomState, question, rankings, toast, finished, clearToast, battleEvent, eliminatedIds } =
    useRoomSocket(code, { role: 'presentation' })

  const remaining = useServerTimer(
    question?.ends_at || roomState?.question_ends_at,
    roomState?.status === 'PAUSED',
  )

  const players = roomState?.players || []
  const scoreMap = Object.fromEntries(
    (rankings.length ? rankings : roomState?.rankings || []).map((r) => [
      r.player_id,
      r.score,
    ]),
  )
  const battlePlayers = players.map((p) => ({
    ...p,
    score: scoreMap[p.player_id] ?? p.score ?? 0,
  }))

  const { fighterStatus, banner, dustBurst, arenaZoom, attackPulse, knockDown, victoryAttack } =
    useBattleFighters(battlePlayers, question?.id ?? `wait-${roomState?.status}`)

  const [countdown, setCountdown] = useState(null)
  const [countdownWinner, setCountdownWinner] = useState('')

  useEffect(() => {
    if (!battleEvent?.at) return
    if (battleEvent.kind === 'wrong' && battleEvent.player_id) {
      knockDown(
        battleEvent.player_id,
        battleEvent.player_name ||
          battlePlayers.find((p) => p.player_id === battleEvent.player_id)?.name,
      )
    }
    if (battleEvent.kind === 'correct' && battleEvent.player_id) {
      const secs = battleEvent.countdown_seconds ?? 3
      victoryAttack(battleEvent.player_id, battleEvent.player_name, battlePlayers, () => {
        setCountdownWinner(battleEvent.player_name || '')
        setCountdown(secs)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleEvent?.at])

  useEffect(() => {
    if (countdown == null) return undefined
    if (countdown <= 0) {
      setCountdown(null)
      return undefined
    }
    const t = setTimeout(() => setCountdown((c) => (c == null ? null : c - 1)), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  useEffect(() => {
    setCountdown(null)
    setCountdownWinner('')
  }, [question?.id])

  if (finished) {
    return (
      <WinnerScreen winner={finished.winner} rankings={finished.rankings || rankings} />
    )
  }

  const firstName =
    rankings.find((r) => r.player_id === roomState?.first_answer_player_id)?.name ||
    toast?.title

  return (
    <div className="arena-bg relative flex min-h-screen flex-col px-6 py-8 md:px-12">
      <NextQuestionCountdown seconds={countdown} winnerName={countdownWinner} />

      <header className="relative z-10 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-arena-accent md:text-4xl">
          ĐẤU TRƯỜNG KIẾN THỨC
        </h1>
        <div className="flex items-center gap-4 text-xl font-bold text-arena-ink md:text-3xl">
          <span className="rounded-full bg-white px-4 py-2 shadow">
            {roomState?.player_count || 0} HS
          </span>
          {remaining != null && roomState?.status === 'RUNNING' && countdown == null && (
            <span
              className={`rounded-full px-5 py-2 font-display font-bold text-white ${
                remaining <= 5 ? 'bg-arena-red' : 'bg-arena-cyan'
              }`}
            >
              {Math.ceil(remaining)}
            </span>
          )}
        </div>
      </header>

      <div className="relative z-10 mt-6">
        <BattleArena
          players={battlePlayers}
          fighterStatus={fighterStatus}
          large
          banner={banner}
          dustBurst={dustBurst}
          zoomed={arenaZoom}
          attackPulse={attackPulse}
        />
      </div>

      {roomState?.status === 'WAITING' && (
        <div className="relative z-10 mt-8 flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-2xl font-bold text-arena-ink/60">Mã phòng</p>
          <p className="mt-2 font-display text-7xl font-bold text-arena-accent md:text-9xl">
            {code?.toUpperCase()}
          </p>
          <p className="mt-6 text-2xl font-extrabold text-arena-ink">
            Chiến binh đang tập hợp...
          </p>
        </div>
      )}

      {question && roomState?.status !== 'WAITING' && (
        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center py-8">
          <p className="font-display text-xl font-bold text-arena-pink md:text-2xl">
            Câu {question.question_number} / {question.total_questions}
          </p>
          <MediaPlayer
            mediaType={question.media_type}
            mediaUrl={question.media_url}
            className="my-4 max-h-80"
          />
          <h2 className="mt-4 text-3xl font-extrabold leading-tight text-arena-ink md:text-5xl">
            {question.content}
          </h2>
          {question.question_type === 'BLOCK_PUZZLE' && (
            <div className="mt-8">
              <p className="mb-3 text-center text-xl font-extrabold text-arena-cyan">
                Ghép khối Scratch · {question.points || 20} điểm
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {(question.pieces || []).map((p) => (
                  <div
                    key={p.uid}
                    className={`scratch-block scratch-block-${p.shape} font-bold text-white`}
                    style={{ background: p.color || '#888' }}
                  >
                    {String(p.label || p.kind).replace(/\{(\d+)\}/g, '□')}
                  </div>
                ))}
              </div>
            </div>
          )}
          {question.question_type === 'MULTIPLE_CHOICE' && (
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {question.options?.map((o, i) => {
                const colors = ['#4cc9f0', '#ff6b9d', '#ffb703', '#06d6a0']
                const gone = (eliminatedIds || []).map(Number).includes(Number(o.id))
                return (
                  <div
                    key={o.id}
                    className={`rounded-3xl border-4 px-6 py-5 text-2xl font-bold shadow-lg md:text-3xl ${
                      gone
                        ? 'border-stone-300 bg-stone-200/80 text-arena-ink/40 line-through grayscale'
                        : 'border-white bg-white text-arena-ink'
                    }`}
                  >
                    <span
                      className="mr-3 inline-flex h-10 w-10 items-center justify-center rounded-xl font-display text-white"
                      style={{ background: gone ? '#9ca3af' : colors[i % 4] }}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    {o.content}
                    {gone ? '  · SAI' : ''}
                  </div>
                )
              })}
            </div>
          )}
          {roomState?.question_answered && firstName && countdown == null && (
            <p className="mt-8 text-center text-2xl font-extrabold text-arena-accent md:text-4xl">
              Quán quân vòng này: {firstName}
            </p>
          )}
        </div>
      )}

      <AnswerToast toast={toast} onDone={clearToast} />
    </div>
  )
}
