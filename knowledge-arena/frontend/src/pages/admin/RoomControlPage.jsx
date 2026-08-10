import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { roomApi } from '../../services/api'
import { useRoomSocket } from '../../hooks/useRoomSocket'
import { useServerTimer } from '../../hooks/useServerTimer'
import AnswerToast from '../../components/AnswerToast'
import LiveScoreboard from '../../components/LiveScoreboard'
import WaitingLobby from '../../components/WaitingLobby'
import WinnerScreen from '../../components/WinnerScreen'
import MediaPlayer from '../../components/MediaPlayer'

export default function RoomControlPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [subs, setSubs] = useState([])
  const [err, setErr] = useState('')

  const {
    roomState,
    question,
    rankings,
    toast,
    finished,
    lobbyMessages,
    lobbyFx,
    lobbyPositions,
    sendLobbyChat,
    sendLobbyAnnounce,
    sendLobbyAction,
    sendLobbyMove,
    clearToast,
    clearLobbyFx,
    status,
  } = useRoomSocket(code, { role: 'admin' })

  const remaining = useServerTimer(
    question?.ends_at || roomState?.question_ends_at,
    roomState?.status === 'PAUSED',
  )

  const refreshSubs = () => {
    roomApi.submissions(code).then((r) => setSubs(r.data)).catch(() => {})
  }

  useEffect(() => {
    refreshSubs()
    const t = setInterval(refreshSubs, 5000)
    return () => clearInterval(t)
  }, [code])

  const act = async (fn) => {
    setBusy(true)
    setErr('')
    try {
      await fn()
      refreshSubs()
    } catch (e) {
      setErr(e.friendlyMessage || 'Lỗi')
    } finally {
      setBusy(false)
    }
  }

  if (finished) {
    return (
      <WinnerScreen
        winner={finished.winner}
        rankings={finished.rankings || rankings}
        onContinue={() => window.location.href = '/admin/rooms'}
      />
    )
  }

  const players = roomState?.players || []
  const answered = roomState?.stats?.answered_count
  // Prefer live submission counts from socket room updates via rankings length of attempts — use state stats when available
  const answeredCount =
    typeof answered === 'number'
      ? answered
      : roomState?.question_answered
        ? players.length
        : 0
  const pending = Math.max(0, players.length - (typeof answered === 'number' ? answered : answeredCount))

  return (
    <div>
      <Link to="/admin/rooms" className="text-sm text-arena-ink/50">
        ← Phòng thi
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-black text-arena-gold">
            {code?.toUpperCase()}
          </h1>
          <p className="text-arena-ink/50">
            {roomState?.exam_title} · {roomState?.status || '...'} · WS: {status}
          </p>
        </div>
        <Link
          to={`/present/${code}`}
          target="_blank"
          className="rounded-xl border border-arena-cyan/40 px-4 py-2 font-bold"
        >
          📺 PRESENTATION MODE
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || roomState?.status === 'RUNNING'}
          onClick={() => act(() => roomApi.start(code))}
          className="rounded-xl bg-emerald-500 px-4 py-3 font-black disabled:opacity-40"
        >
          ▶ BẮT ĐẦU
        </button>
        <button
          type="button"
          disabled={busy || roomState?.status !== 'RUNNING'}
          onClick={() => act(() => roomApi.next(code))}
          className="rounded-xl bg-arena-accent px-4 py-3 font-black disabled:opacity-40"
        >
          ⏭ CÂU TIẾP THEO
        </button>
        {roomState?.status === 'PAUSED' ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => roomApi.resume(code))}
            className="rounded-xl bg-cyan-600 px-4 py-3 font-black"
          >
            ▶ TIẾP TỤC
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || roomState?.status !== 'RUNNING'}
            onClick={() => act(() => roomApi.pause(code))}
            className="rounded-xl bg-amber-600 px-4 py-3 font-black disabled:opacity-40"
          >
            ⏸ TẠM DỪNG
          </button>
        )}
        <button
          type="button"
          disabled={busy || roomState?.status === 'FINISHED'}
          onClick={() => act(() => roomApi.finish(code))}
          className="rounded-xl bg-rose-600 px-4 py-3 font-black disabled:opacity-40"
        >
          KẾT THÚC
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!confirm(`Xóa phòng ${code?.toUpperCase()}?`)) return
            act(async () => {
              await roomApi.remove(code)
              navigate('/admin/rooms')
            })
          }}
          className="rounded-xl border border-arena-red/50 bg-red-500/10 px-4 py-3 font-black text-arena-red"
        >
          XÓA PHÒNG
        </button>
      </div>
      {err && <p className="mt-2 text-arena-red">{err}</p>}

      {(roomState?.status === 'WAITING' || !roomState?.status) && (
        <div className="mt-6">
          <WaitingLobby
            roomCode={code}
            players={players}
            isAdmin
            hostName={roomState?.host_name || 'Thầy Phú Anex'}
            messages={lobbyMessages}
            lobbyFx={lobbyFx}
            positions={lobbyPositions}
            onSendChat={sendLobbyChat}
            onAnnounce={sendLobbyAnnounce}
            onAction={sendLobbyAction}
            onMove={sendLobbyMove}
            onClearFx={clearLobbyFx}
          />
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="glass rounded-2xl p-5">
          <p className="text-sm text-arena-ink/50">Câu hỏi</p>
          <p className="font-display text-3xl font-black">
            {(roomState?.current_question_index ?? -1) + 1} /{' '}
            {roomState?.total_questions ?? '?'}
          </p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-sm text-arena-ink/50">Người tham gia</p>
          <p className="font-display text-3xl font-black">👥 {players.length}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-sm text-arena-ink/50">Thời gian còn</p>
          <p className="font-display text-3xl font-black text-arena-cyan">
            ⏱ {remaining != null ? Math.ceil(remaining) : '—'}s
          </p>
          <p className="mt-1 text-sm text-arena-ink/50">
            Đã trả lời: {typeof answered === 'number' ? answered : answeredCount} · Chưa: {pending}
            {roomState?.question_answered ? ' · 🔒 Đã có đáp án đúng' : ''}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_240px]">
        <div className="glass rounded-2xl p-5">
          {roomState?.status === 'WAITING' && (
            <div>
              <p className="text-lg font-bold">
                👥 {players.length} học sinh đang chờ
              </p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {players.map((p) => (
                  <li key={p.player_id} className="rounded-lg bg-arena-sky/10 px-3 py-2">
                    👤 {p.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {question && (
            <div>
              <p className="text-xs font-bold text-arena-gold">
                CÂU {question.question_number}
              </p>
              <MediaPlayer
                mediaType={question.media_type}
                mediaUrl={question.media_url}
                className="my-3"
              />
              <h2 className="text-xl font-bold md:text-2xl">{question.content}</h2>
              {question.question_type === 'MULTIPLE_CHOICE' && (
                <ul className="mt-3 space-y-1 text-arena-ink/70">
                  {question.options?.map((o, i) => (
                    <li key={o.id}>
                      {String.fromCharCode(65 + i)}. {o.content}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <LiveScoreboard
          rankings={rankings.length ? rankings : roomState?.rankings || []}
          compact={false}
        />
      </div>

      <div className="glass mt-6 rounded-2xl p-5">
        <h3 className="font-bold">Chấm tự luận / Bài nộp</h3>
        <div className="mt-3 space-y-2">
          {subs
            .filter((s) => s.answer_text)
            .map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-arena-sky/10 p-3"
              >
                <div>
                  <p className="font-semibold">{s.player_name}</p>
                  <p className="text-sm text-arena-ink/70">{s.answer_text}</p>
                  <p className="text-xs text-arena-ink/45">
                    {s.essay_graded
                      ? s.is_correct
                        ? `✓ +${s.points}`
                        : '✗ Sai'
                      : 'Chưa chấm'}
                  </p>
                </div>
                {!s.essay_graded && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-bold"
                      onClick={() =>
                        act(() =>
                          roomApi.grade(code, s.id, { is_correct: true, points: 10 }),
                        )
                      }
                    >
                      Đúng +10
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-bold"
                      onClick={() =>
                        act(() =>
                          roomApi.grade(code, s.id, { is_correct: false, points: 0 }),
                        )
                      }
                    >
                      Sai
                    </button>
                  </div>
                )}
              </div>
            ))}
          {!subs.filter((s) => s.answer_text).length && (
            <p className="text-sm text-arena-ink/50">Chưa có bài tự luận.</p>
          )}
        </div>
      </div>

      <AnswerToast toast={toast} onDone={clearToast} />
    </div>
  )
}
