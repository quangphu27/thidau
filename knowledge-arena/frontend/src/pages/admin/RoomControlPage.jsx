import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { roomApi } from '../../services/api'
import { useRoomSocket } from '../../hooks/useRoomSocket'
import { useServerTimer } from '../../hooks/useServerTimer'
import { useRoomVoice } from '../../hooks/useRoomVoice'
import AnswerToast from '../../components/AnswerToast'
import LiveScoreboard from '../../components/LiveScoreboard'
import WaitingLobby from '../../components/WaitingLobby'
import WinnerScreen from '../../components/WinnerScreen'
import MediaPlayer from '../../components/MediaPlayer'
import BuzzerButton from '../../components/BuzzerButton'

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
    eliminatedIds,
    buzzer,
    judge,
    revealBuzzer,
    status,
    lastEvent,
    wsRef,
  } = useRoomSocket(code, { role: 'admin' })

  const { micOn, micError, startMic, stopMic } = useRoomVoice({
    wsRef,
    role: 'admin',
    playerId: null,
    lastEvent,
    status,
  })

  const isBuzzer = roomState?.mode === 'BUZZER'

  const remaining = useServerTimer(
    question?.ends_at || roomState?.question_ends_at,
    roomState?.status === 'PAUSED',
  )
  const answerLeft = useServerTimer(
    isBuzzer && buzzer.phase === 'CLAIMED' ? buzzer.answer_ends_at : null,
    false,
  )
  const answerExpired =
    isBuzzer && buzzer.phase === 'CLAIMED' && answerLeft != null && answerLeft <= 0

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

  const doJudge = async (correct) => {
    setBusy(true)
    setErr('')
    try {
      await roomApi.judge(code, correct)
    } catch (e) {
      judge(correct)
      if (e.friendlyMessage) setErr(e.friendlyMessage)
    } finally {
      setBusy(false)
    }
  }

  const doReveal = async () => {
    setBusy(true)
    setErr('')
    try {
      await roomApi.revealBuzzer(code)
    } catch (e) {
      revealBuzzer()
      if (e.friendlyMessage) setErr(e.friendlyMessage)
    } finally {
      setBusy(false)
    }
  }

  if (finished || roomState?.status === 'FINISHED') {
    return (
      <WinnerScreen
        winner={finished?.winner || rankings[0] || null}
        rankings={finished?.rankings || rankings}
        onContinue={() => {
          window.location.href = '/admin/rooms'
        }}
      />
    )
  }

  const players = roomState?.players || []
  const answered = roomState?.stats?.answered_count
  const answeredCount =
    typeof answered === 'number'
      ? answered
      : roomState?.question_answered
        ? players.length
        : 0
  const pending = Math.max(
    0,
    players.length - (typeof answered === 'number' ? answered : answeredCount),
  )

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
            {roomState?.exam_title} · {isBuzzer ? 'Chuông · ' : ''}
            {roomState?.status || '...'} · WS: {status}
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

      <div
        className={`mt-4 flex flex-wrap items-center gap-3 rounded-2xl border-4 p-4 ${
          micOn
            ? 'border-emerald-500 bg-emerald-500/15'
            : 'border-slate-300 bg-slate-100/80'
        }`}
      >
        <div className="flex-1">
          <p className="font-display text-lg font-black">
            {micOn ? '🎙️ Micro đang BẬT' : '🎙️ Micro đang TẮT'}
          </p>
          <p className="text-sm font-bold text-arena-ink/60">
            {micOn
              ? 'Học sinh trong phòng đang nghe giọng bạn realtime. Bấm Tắt khi không cần.'
              : 'Bật mic để đọc câu hỏi / hướng dẫn — học sinh nghe qua loa thiết bị.'}
          </p>
        </div>
        {micOn ? (
          <button
            type="button"
            onClick={stopMic}
            className="rounded-xl bg-rose-600 px-6 py-3 font-black text-white shadow"
          >
            TẮT MIC
          </button>
        ) : (
          <button
            type="button"
            onClick={startMic}
            className="rounded-xl bg-emerald-600 px-6 py-3 font-black text-white shadow"
          >
            BẬT MIC
          </button>
        )}
      </div>
      {micError && <p className="mt-2 font-bold text-amber-700">{micError}</p>}
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

      {isBuzzer && roomState?.status === 'RUNNING' && !buzzer.revealed && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border-4 border-arena-cyan bg-arena-cyan/15 p-4">
          <div className="flex-1">
            <p className="font-display text-xl font-black">Đang giai câu hỏi qua mic</p>
            <p className="text-sm font-bold text-arena-ink/60">
              Học sinh chưa thấy đề. Khi đọc xong, bấm Bắt đầu để hiện câu hỏi + chuông.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={doReveal}
            className="rounded-xl bg-arena-accent px-6 py-3 font-black text-white"
          >
            🔔 BẮT ĐẦU (hiện câu + chuông)
          </button>
        </div>
      )}

      {isBuzzer && roomState?.status === 'RUNNING' && buzzer.phase === 'CLAIMED' && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border-4 border-arena-gold bg-arena-gold/20 p-4">
          <p className="flex-1 font-display text-xl font-black">
            {buzzer.claimer_name} đang trả lời
            {answerLeft != null && !answerExpired
              ? ` — ${Math.ceil(answerLeft)}s`
              : answerExpired
                ? ' — hết 10s (vẫn chấm được)'
                : ''}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => doJudge(true)}
            className="rounded-xl bg-emerald-500 px-6 py-3 font-black text-white"
          >
            ✅ ĐÚNG
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => doJudge(false)}
            className="rounded-xl bg-rose-500 px-6 py-3 font-black text-white"
          >
            ❌ SAI
          </button>
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
          <p className="text-sm text-arena-ink/50">{isBuzzer ? 'Chuông' : 'Thời gian'}</p>
          <p className="font-display text-3xl font-black">
            {isBuzzer
              ? !buzzer.revealed
                ? 'Đang đọc'
                : buzzer.phase === 'CLAIMED'
                  ? buzzer.claimer_name
                  : buzzer.phase === 'VISIBLE'
                    ? 'Sẵn sàng'
                    : 'Đợi chuông...'
              : remaining != null
                ? Math.ceil(remaining)
                : '—'}
          </p>
          {!isBuzzer && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={
                  busy ||
                  (roomState?.status !== 'RUNNING' && roomState?.status !== 'PAUSED') ||
                  !question
                }
                onClick={() => act(() => roomApi.adjustTime(code, -5))}
                className="rounded-lg bg-stone-200 px-3 py-1.5 text-sm font-black disabled:opacity-40"
              >
                −5s
              </button>
              <button
                type="button"
                disabled={
                  busy ||
                  (roomState?.status !== 'RUNNING' && roomState?.status !== 'PAUSED') ||
                  !question
                }
                onClick={() => act(() => roomApi.adjustTime(code, 5))}
                className="rounded-lg bg-arena-cyan px-3 py-1.5 text-sm font-black text-white disabled:opacity-40"
              >
                +5s
              </button>
            </div>
          )}
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-sm text-arena-ink/50">Học sinh</p>
          <p className="font-display text-3xl font-black">{players.length}</p>
        </div>
      </div>

      {question && roomState?.status !== 'WAITING' && (
        <div className="relative mt-6 min-h-[200px]">
          {isBuzzer && buzzer.revealed && (
            <BuzzerButton
              visible={buzzer.phase === 'VISIBLE'}
              claimed={buzzer.phase === 'CLAIMED'}
              claimerName={buzzer.claimer_name}
              answerLeft={answerLeft}
              answerExpired={answerExpired}
              x={buzzer.x}
              y={buzzer.y}
              disabled
            />
          )}
          <div className="glass rounded-[2rem] p-6">
            {!isBuzzer || buzzer.revealed ? (
              <>
                <MediaPlayer
                  mediaType={question.media_type}
                  mediaUrl={question.media_url}
                  className="mb-4"
                />
                <h2 className="whitespace-pre-wrap text-2xl font-extrabold text-arena-ink">
                  {question.content}
                </h2>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-amber-700">
                  Chỉ admin thấy đề lúc này — học sinh đang nghe mic
                </p>
                <MediaPlayer
                  mediaType={question.media_type}
                  mediaUrl={question.media_url}
                  className="my-3"
                />
                <h2 className="whitespace-pre-wrap text-2xl font-extrabold text-arena-ink">
                  {question.content}
                </h2>
              </>
            )}
            <p className="mt-2 text-sm font-bold text-arena-cyan">
              {question.points || 10} điểm
              {isBuzzer ? ' · Trả lời miệng (10s sau khi buzz)' : ''}
            </p>
            {!isBuzzer && question.question_type === 'MULTIPLE_CHOICE' && (
              <ul className="mt-4 space-y-2">
                {(question.options || []).map((o, i) => {
                  const gone = (eliminatedIds || []).map(Number).includes(Number(o.id))
                  return (
                    <li
                      key={o.id}
                      className={`rounded-xl px-3 py-2 font-bold ${
                        gone ? 'bg-stone-200 line-through opacity-50' : 'bg-white/80'
                      }`}
                    >
                      {String.fromCharCode(65 + i)}. {o.content}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <LiveScoreboard rankings={rankings.length ? rankings : roomState?.rankings || []} />
        {!isBuzzer && (
          <div className="glass rounded-2xl p-5">
            <h3 className="font-display text-lg font-bold">Bài nộp / tự luận</h3>
            <p className="text-sm text-arena-ink/50">
              Đã trả lời: {answeredCount} · Còn lại: {pending}
            </p>
            <ul className="mt-3 max-h-64 space-y-2 overflow-auto text-sm">
              {subs.map((s) => (
                <li key={s.id} className="rounded-xl bg-white/70 px-3 py-2">
                  <span className="font-bold">{s.player_name}</span>:{' '}
                  {s.answer_text || s.answer_display || '—'}{' '}
                  {s.is_correct === true ? '✅' : s.is_correct === false ? '❌' : '⏳'}
                  {!s.essay_graded && s.answer_text && (
                    <span className="ml-2 space-x-1">
                      <button
                        type="button"
                        className="rounded bg-emerald-500 px-2 py-0.5 text-white"
                        onClick={() =>
                          act(() =>
                            roomApi.grade(code, s.id, { is_correct: true, points: 10 }),
                          )
                        }
                      >
                        Đúng
                      </button>
                      <button
                        type="button"
                        className="rounded bg-rose-500 px-2 py-0.5 text-white"
                        onClick={() =>
                          act(() =>
                            roomApi.grade(code, s.id, { is_correct: false, points: 0 }),
                          )
                        }
                      >
                        Sai
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <AnswerToast toast={toast} onDone={clearToast} />
    </div>
  )
}
