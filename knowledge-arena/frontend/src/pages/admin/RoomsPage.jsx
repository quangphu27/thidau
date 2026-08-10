import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { examApi, roomApi } from '../../services/api'

export default function RoomsPage() {
  const [rooms, setRooms] = useState([])
  const [exams, setExams] = useState([])
  const [examId, setExamId] = useState('')
  const [created, setCreated] = useState(null)
  const [error, setError] = useState('')

  const load = () => roomApi.list().then((r) => setRooms(r.data)).catch(() => {})

  useEffect(() => {
    examApi.list().then((r) => {
      setExams(r.data)
      if (r.data[0]) setExamId(String(r.data[0].id))
    })
    load()
  }, [])

  const create = async () => {
    setError('')
    try {
      const { data } = await roomApi.create(Number(examId))
      setCreated(data)
      load()
    } catch (err) {
      setError(err.friendlyMessage || 'Không tạo được phòng')
    }
  }

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('Đã sao chép!')
    } catch {
      prompt('Sao chép link:', text)
    }
  }

  const removeRoom = async (code) => {
    if (!confirm(`Xóa phòng ${code}? Học sinh sẽ không vào được phòng này nữa.`)) return
    try {
      await roomApi.remove(code)
      if (created?.room_code === code) setCreated(null)
      load()
    } catch (err) {
      alert(err.friendlyMessage || 'Không xóa được phòng')
    }
  }

  const statusColor = {
    WAITING: 'text-amber-300',
    RUNNING: 'text-emerald-300',
    PAUSED: 'text-orange-300',
    FINISHED: 'text-arena-ink/50',
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-black">🎮 Phòng thi</h1>

      <div className="glass mt-4 flex flex-wrap items-end gap-3 rounded-2xl p-5">
        <div>
          <label className="text-sm text-arena-ink/50">Chọn bài thi</label>
          <select
            className="mt-1 block rounded-xl border border-arena-sky/30 bg-white px-3 py-2"
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
          >
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} ({e.question_count} câu)
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={create}
          className="rounded-xl bg-arena-accent px-5 py-2.5 font-black"
        >
          🎮 TẠO PHÒNG
        </button>
      </div>
      {error && <p className="mt-2 text-arena-red">{error}</p>}

      {created && (
        <div className="glass mt-6 rounded-3xl p-8 text-center">
          <p className="text-sm font-bold tracking-widest text-arena-ink/50">MÃ PHÒNG</p>
          <p className="mt-2 font-display text-5xl font-black text-arena-gold md:text-7xl">
            {created.room_code}
          </p>
          <p className="mt-4 text-sm text-arena-ink/50">Link tham gia:</p>
          <p className="mt-1 break-all font-mono text-arena-cyan">{created.join_url}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => copy(created.join_url)}
              className="rounded-xl bg-arena-sky/20 px-4 py-2 font-bold"
            >
              📋 Sao chép link
            </button>
            <Link
              to={`/admin/rooms/${created.room_code}`}
              className="rounded-xl bg-arena-accent px-4 py-2 font-bold"
            >
              Điều khiển phòng
            </Link>
            <Link
              to={`/present/${created.room_code}`}
              target="_blank"
              className="rounded-xl border border-arena-cyan/40 px-4 py-2 font-bold"
            >
              📺 Presentation
            </Link>
          </div>
        </div>
      )}

      <div className="mt-8 space-y-3">
        <h2 className="font-bold text-arena-ink/70">Danh sách phòng</h2>
        {rooms.map((r) => (
          <div
            key={r.id}
            className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
          >
            <div>
              <p className="font-display text-xl font-bold text-arena-gold">
                {r.room_code}
              </p>
              <p className="text-sm text-arena-ink/50">
                {r.exam_title} ·{' '}
                <span className={statusColor[r.status]}>{r.status}</span> ·{' '}
                {r.player_count} HS
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/admin/rooms/${r.room_code}`}
                className="rounded-lg bg-arena-accent px-3 py-2 text-sm font-bold"
              >
                Điều khiển
              </Link>
              <Link
                to={`/present/${r.room_code}`}
                target="_blank"
                className="rounded-lg bg-arena-sky/20 px-3 py-2 text-sm"
              >
                Chiếu
              </Link>
              <button
                type="button"
                onClick={() => removeRoom(r.room_code)}
                className="rounded-lg bg-red-500/15 px-3 py-2 text-sm font-semibold text-arena-red"
              >
                Xóa
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
