import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../../services/api'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await authApi.login(username, password)
      localStorage.setItem('admin_token', data.access_token)
      navigate('/admin')
    } catch (err) {
      setError(err.friendlyMessage || 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="arena-bg flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="glass relative z-10 w-full max-w-sm rounded-[2rem] p-8">
        <Link to="/" className="text-sm font-bold text-arena-cyan">
          ← Trang chủ
        </Link>
        <h1 className="mt-3 font-display text-2xl font-bold text-arena-ink">
          Admin đăng nhập
        </h1>
        <p className="mt-1 text-sm font-semibold text-arena-ink/50">Đấu Trường Kiến Thức</p>
        <label className="mt-6 block text-sm font-bold">Tên đăng nhập</label>
        <input
          className="mt-1 w-full rounded-2xl border-4 border-arena-sky/30 bg-white px-3 py-2.5 font-bold outline-none focus:border-arena-cyan"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <label className="mt-3 block text-sm font-bold">Mật khẩu</label>
        <input
          type="password"
          className="mt-1 w-full rounded-2xl border-4 border-arena-sky/30 bg-white px-3 py-2.5 font-bold outline-none focus:border-arena-cyan"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="mt-3 text-sm font-bold text-arena-red">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-full bg-arena-accent py-3 font-black text-white shadow-[0_6px_0_#c43a1a] disabled:opacity-60"
        >
          {loading ? '...' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  )
}
