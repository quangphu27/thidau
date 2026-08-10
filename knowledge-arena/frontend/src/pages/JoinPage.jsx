import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { roomApi } from '../services/api'

export default function JoinPage() {
  const { code: codeParam } = useParams()
  const navigate = useNavigate()
  const [code, setCode] = useState((codeParam || '').toUpperCase())
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('Vui lòng nhập tên của bạn')
      return
    }
    if (!code.trim()) {
      setError('Vui lòng nhập mã phòng')
      return
    }
    setLoading(true)
    try {
      const { data } = await roomApi.join(code.trim().toUpperCase(), name.trim())
      sessionStorage.setItem(
        `player_${data.room_code}`,
        JSON.stringify({
          player_id: data.player_id,
          name: data.name,
          score: data.score,
        }),
      )
      navigate(`/play/${data.room_code}`)
    } catch (err) {
      setError(err.friendlyMessage || 'Không thể tham gia phòng')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="arena-bg flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="glass relative z-10 w-full max-w-md rounded-[2rem] p-8"
      >
        <Link to="/" className="text-sm font-bold text-arena-cyan hover:underline">
          ← Trang chủ
        </Link>
        <div className="mt-3 text-center text-4xl">🎒</div>
        <h1 className="mt-2 text-center font-display text-2xl font-bold text-arena-ink">
          Tham gia phòng thi
        </h1>
        <p className="mt-2 text-center text-sm font-semibold text-arena-ink/60">
          Nhập mã phòng và tên thật dễ thương của bạn nhé!
        </p>

        <label className="mt-6 block text-sm font-bold text-arena-ink">Mã phòng</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={8}
          className="mt-1 w-full rounded-2xl border-4 border-arena-gold/50 bg-white px-4 py-3 text-center font-display text-3xl tracking-widest text-arena-accent outline-none focus:border-arena-accent"
          placeholder="ABC123"
        />

        <label className="mt-4 block text-sm font-bold text-arena-ink">Tên của bạn</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          className="mt-1 w-full rounded-2xl border-4 border-arena-sky/40 bg-white px-4 py-3 text-lg font-bold text-arena-ink outline-none focus:border-arena-cyan"
          placeholder="Nguyễn Văn An"
        />

        {error && (
          <p className="mt-3 rounded-2xl bg-arena-red/15 px-3 py-2 text-sm font-bold text-arena-red">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-full bg-arena-green py-4 text-lg font-black text-white shadow-[0_8px_0_#049a72] transition hover:brightness-105 active:translate-y-1 active:shadow-[0_4px_0_#049a72] disabled:opacity-60"
        >
          {loading ? 'Đang vào...' : '🚀 THAM GIA'}
        </button>
      </form>
    </div>
  )
}
