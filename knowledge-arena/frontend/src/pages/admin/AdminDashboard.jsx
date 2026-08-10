import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardApi } from '../../services/api'
import { FileText, HelpCircle, Gamepad2, Users } from 'lucide-react'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [lan, setLan] = useState(null)

  useEffect(() => {
    dashboardApi.stats().then((r) => setStats(r.data)).catch(() => {})
    dashboardApi.lanIp().then((r) => setLan(r.data)).catch(() => {})
  }, [])

  const cards = [
    { label: 'Tổng số bài thi', value: stats?.total_exams ?? '—', icon: FileText, color: 'text-orange-400' },
    { label: 'Tổng số câu hỏi', value: stats?.total_questions ?? '—', icon: HelpCircle, color: 'text-cyan-400' },
    { label: 'Phòng đang hoạt động', value: stats?.active_rooms ?? '—', icon: Gamepad2, color: 'text-pink-400' },
    { label: 'Học sinh đang thi', value: stats?.active_players ?? '—', icon: Users, color: 'text-emerald-400' },
  ]

  return (
    <div>
      <h1 className="font-display text-2xl font-black md:text-3xl">🏠 Tổng quan</h1>
      <p className="mt-1 text-arena-ink/50">Bảng điều khiển Đấu Trường Kiến Thức</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="glass rounded-2xl p-5">
            <c.icon className={`mb-3 ${c.color}`} size={28} />
            <p className="text-3xl font-black">{c.value}</p>
            <p className="mt-1 text-sm text-arena-ink/50">{c.label}</p>
          </div>
        ))}
      </div>

      {lan && (
        <div className="glass mt-6 rounded-2xl p-5">
          <h2 className="font-bold text-arena-accent">📡 Truy cập LAN</h2>
          <p className="mt-2 text-sm text-arena-ink/70">
            IP máy chủ: <span className="font-mono text-arena-cyan">{lan.ip}</span>
          </p>
          <p className="mt-1 text-sm">
            Admin:{' '}
            <a className="text-arena-accent underline" href={lan.admin_url}>
              {lan.admin_url}
            </a>
          </p>
          <p className="mt-1 text-sm">
            Học sinh:{' '}
            <a className="text-arena-accent underline" href={lan.frontend_url}>
              {lan.frontend_url}
            </a>
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/admin/exams"
          className="rounded-full bg-arena-accent px-5 py-3 font-black text-white shadow-[0_5px_0_#c43a1a]"
        >
          + Tạo bài thi
        </Link>
        <Link
          to="/admin/rooms"
          className="rounded-full border-4 border-arena-cyan bg-white px-5 py-3 font-bold text-arena-cyan"
        >
          🎮 Phòng thi
        </Link>
      </div>
    </div>
  )
}
