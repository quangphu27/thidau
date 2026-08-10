import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRoomSocket } from '../hooks/useRoomSocket'
import { useServerTimer } from '../hooks/useServerTimer'
import AnswerOption from '../components/AnswerOption'
import AnswerToast from '../components/AnswerToast'
import LiveScoreboard from '../components/LiveScoreboard'
import MediaPlayer from '../components/MediaPlayer'
import BattleArena from '../components/BattleArena'
import NextQuestionCountdown from '../components/NextQuestionCountdown'
import WaitingLobby from '../components/WaitingLobby'
import WinnerScreen from '../components/WinnerScreen'
import { mediaUrl } from '../utils/config'
import { useBattleFighters } from '../hooks/useBattleFighters'

export default function PlayPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const playerInfo = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem(`player_${code?.toUpperCase()}`) || 'null')
    } catch {
      return null
    }
  }, [code])

  useEffect(() => {
    if (!playerInfo?.player_id) {
      navigate(`/join/${code}`)
    }
  }, [playerInfo, code, navigate])

  const {
    roomState,
    question,
    rankings,
    alreadySubmitted,
    toast,
    finished,
    battleEvent,
    autoNext,
    lobbyMessages,
    lobbyFx,
    lobbyPositions,
    submitAnswer,
    sendLobbyChat,
    sendLobbyAction,
    sendLobbyMove,
    clearToast,
    clearLobbyFx,
    status,
  } = useRoomSocket(code, {
    role: 'student',
    playerId: playerInfo?.player_id,
    enabled: !!playerInfo?.player_id,
  })

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
    useBattleFighters(battlePlayers, question?.id)

  const [countdown, setCountdown] = useState(null)
  const [countdownWinner, setCountdownWinner] = useState('')

  useEffect(() => {
    if (!battleEvent?.at) return
    if (battleEvent.kind === 'wrong' && battleEvent.player_id) {
      const name =
        battleEvent.player_name ||
        battlePlayers.find((p) => p.player_id === battleEvent.player_id)?.name ||
        playerInfo?.name
      knockDown(battleEvent.player_id, name)
    }
    if (battleEvent.kind === 'correct' && battleEvent.player_id) {
      const secs = battleEvent.countdown_seconds ?? autoNext?.countdownSeconds ?? 3
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
    if (!question?.id) return
    setCountdown(null)
    setCountdownWinner('')
  }, [question?.id])

  const [essayText, setEssayText] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [lockedLocal, setLockedLocal] = useState(false)

  const endsAt = question?.ends_at || roomState?.question_ends_at
  const remaining = useServerTimer(endsAt, roomState?.status === 'PAUSED')
  const expired = remaining != null && remaining <= 0
  const locked =
    lockedLocal ||
    alreadySubmitted ||
    roomState?.question_answered ||
    expired ||
    roomState?.status === 'PAUSED' ||
    countdown != null

  useEffect(() => {
    setEssayText('')
    setSelectedId(null)
    setLockedLocal(false)
  }, [question?.id])

  const myScore =
    rankings.find((r) => r.player_id === playerInfo?.player_id)?.score ??
    roomState?.your_score ??
    playerInfo?.score ??
    0

  if (finished) {
    return (
      <WinnerScreen winner={finished.winner} rankings={finished.rankings || rankings} />
    )
  }

  const waiting = !question || roomState?.status === 'WAITING'

  const onSelect = (opt) => {
    if (locked) return
    setSelectedId(opt.id)
    setLockedLocal(true)
    submitAnswer({ questionId: question.id, answerId: opt.id })
  }

  const onEssay = (e) => {
    e.preventDefault()
    if (locked || !essayText.trim()) return
    setLockedLocal(true)
    submitAnswer({ questionId: question.id, answerText: essayText.trim() })
  }

  return (
    <div className="arena-bg relative min-h-screen pb-10">
      <NextQuestionCountdown seconds={countdown} winnerName={countdownWinner} />

      <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-8">
        <div>
          <h1 className="font-display text-base font-bold text-arena-accent md:text-lg">
            ĐẤU TRƯỜNG KIẾN THỨC
          </h1>
          {question && (
            <p className="text-sm font-bold text-arena-ink/60">
              Câu {question.question_number} / {question.total_questions}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full border-2 border-white bg-white px-3 py-1.5 text-sm font-bold text-arena-ink shadow-sm">
            {playerInfo?.name}
          </div>
          <div className="rounded-full border-2 border-arena-gold bg-arena-gold px-3 py-1.5 font-display font-bold text-arena-ink shadow-sm">
            {myScore} điểm
          </div>
          {remaining != null && roomState?.status === 'RUNNING' && countdown == null && (
            <div
              className={`rounded-full px-4 py-1.5 font-display text-2xl font-bold text-white shadow-md ${
                remaining <= 5 ? 'bg-arena-red' : 'bg-arena-cyan'
              }`}
            >
              {Math.ceil(remaining)}
            </div>
          )}
        </div>
      </header>

      <div className="relative z-10 mx-auto grid max-w-6xl gap-4 px-4 md:grid-cols-[1fr_210px] md:px-8">
        <div className="space-y-4">
          {!waiting && (
            <BattleArena
              players={battlePlayers}
              fighterStatus={fighterStatus}
              myPlayerId={playerInfo?.player_id}
              banner={banner}
              dustBurst={dustBurst}
              zoomed={arenaZoom}
              attackPulse={attackPulse}
            />
          )}

          {status === 'disconnected' && (
            <p className="mb-3 rounded-2xl bg-amber-100 px-3 py-2 text-sm font-bold text-amber-800">
              Mất kết nối — đang thử kết nối lại...
            </p>
          )}

          {waiting && (
            <WaitingLobby
              roomCode={code}
              players={roomState?.players || []}
              myPlayerId={playerInfo?.player_id}
              myName={playerInfo?.name}
              hostName={roomState?.host_name || 'Thầy Phú Anex'}
              messages={lobbyMessages}
              lobbyFx={lobbyFx}
              positions={lobbyPositions}
              onSendChat={sendLobbyChat}
              onAction={sendLobbyAction}
              onMove={sendLobbyMove}
              onClearFx={clearLobbyFx}
            />
          )}

          {question && roomState?.status !== 'WAITING' && roomState?.status !== 'FINISHED' && (
            <div className="float-in space-y-4">
              {expired && countdown == null && (
                <div className="rounded-3xl bg-arena-red py-3 text-center font-display text-xl font-bold text-white shadow-lg">
                  HẾT GIỜ!
                </div>
              )}

              <div className="glass rounded-[2rem] p-5 md:p-8">
                {(question.media_position === 'BEFORE' || !question.media_position) && (
                  <MediaPlayer
                    mediaType={question.media_type}
                    mediaUrl={question.media_url}
                    className="mb-4"
                  />
                )}
                <h2 className="text-xl font-extrabold leading-snug text-arena-ink md:text-3xl">
                  {question.content}
                </h2>
                {question.media_position === 'AFTER' && (
                  <MediaPlayer
                    mediaType={question.media_type}
                    mediaUrl={question.media_url}
                    className="mt-4"
                  />
                )}
              </div>

              {question.question_type === 'MULTIPLE_CHOICE' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {(question.options || []).map((opt, i) => (
                    <AnswerOption
                      key={opt.id}
                      option={{
                        ...opt,
                        media_url: opt.media_url ? mediaUrl(opt.media_url) : null,
                      }}
                      index={i}
                      disabled={locked}
                      selected={selectedId === opt.id}
                      onSelect={onSelect}
                      large
                    />
                  ))}
                </div>
              ) : (
                <form onSubmit={onEssay} className="glass rounded-[2rem] p-5">
                  <textarea
                    value={essayText}
                    onChange={(e) => setEssayText(e.target.value)}
                    disabled={locked}
                    rows={4}
                    placeholder="Gõ câu trả lời của bạn ở đây..."
                    className="w-full rounded-2xl border-4 border-arena-sky/30 bg-white p-4 font-bold text-arena-ink outline-none focus:border-arena-cyan disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={locked || !essayText.trim()}
                    className="mt-3 w-full rounded-full bg-arena-accent py-3 font-black text-white shadow-[0_6px_0_#c43a1a] disabled:opacity-50"
                  >
                    Gửi đáp án
                  </button>
                </form>
              )}

              {locked && !expired && countdown == null && (
                <p className="text-center font-display text-lg font-bold text-arena-accent">
                  ĐÃ CHỐT ĐÁP ÁN
                </p>
              )}
            </div>
          )}
        </div>

        <aside className="relative z-10 hidden md:block">
          <LiveScoreboard rankings={rankings.length ? rankings : roomState?.rankings || []} />
        </aside>
      </div>

      <div className="relative z-10 mt-4 px-4 md:hidden">
        <LiveScoreboard rankings={rankings.length ? rankings : roomState?.rankings || []} />
      </div>

      <AnswerToast toast={toast} onDone={clearToast} />
    </div>
  )
}
