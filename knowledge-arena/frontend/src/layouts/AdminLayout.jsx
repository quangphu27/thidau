import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  HelpCircle,
  Gamepad2,
  Trophy,
  Settings,
  LogOut,
} from 'lucide-react'

const links = [
  { to: '/admin', end: true, icon: LayoutDashboard, label: 'Tổng quan' },
  { to: '/admin/exams', icon: FileText, label: 'Bài thi' },
  { to: '/admin/questions', icon: HelpCircle, label: 'Ngân hàng câu hỏi' },
  { to: '/admin/rooms', icon: Gamepad2, label: 'Phòng thi' },
  { to: '/admin/results', icon: Trophy, label: 'Kết quả' },
  { to: '/admin/settings', icon: Settings, label: 'Cài đặt' },
]

export default function AdminLayout() {
  const navigate = useNavigate()

  const logout = () => {
    localStorage.removeItem('admin_token')
    navigate('/admin/login')
  }

  return (
    <div className="arena-bg flex min-h-screen text-arena-ink">
      <aside className="relative z-10 hidden w-64 shrink-0 flex-col border-r-4 border-white/80 bg-white/90 p-4 shadow-lg md:flex">
        <div className="mb-8 px-2">
          <p className="font-display text-xs font-bold tracking-widest text-arena-accent">
            ADMIN
          </p>
          <h1 className="mt-1 text-lg font-black leading-tight text-arena-ink">
            Đấu Trường Kiến Thức
          </h1>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {links.map(({ to, end, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition ${
                  isActive
                    ? 'bg-arena-accent text-white shadow-md'
                    : 'text-arena-ink/70 hover:bg-arena-sky/20 hover:text-arena-ink'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={logout}
          className="mt-4 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold text-arena-ink/50 hover:bg-arena-red/10 hover:text-arena-red"
        >
          <LogOut size={18} />
          Đăng xuất
        </button>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b-4 border-white/70 bg-white/80 px-4 py-3 md:hidden">
          <span className="font-display font-bold text-arena-accent">Đấu Trường KT</span>
          <button
            type="button"
            onClick={logout}
            className="text-sm font-bold text-arena-ink/50"
          >
            Đăng xuất
          </button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b-4 border-white/70 bg-white/70 px-2 py-2 md:hidden">
          {links.map(({ to, end, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-bold ${
                  isActive ? 'bg-arena-accent text-white' : 'text-arena-ink/60'
                }`
              }
            >
              <Icon size={14} />
              {label}
            </NavLink>
          ))}
        </nav>
        <main className="flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
