import { useEffect, useState } from 'react'
import { authApi, dashboardApi } from '../../services/api'

export default function SettingsPage() {
  const [settings, setSettings] = useState({ sound_enabled: true, admin_display_name: 'Thầy Phú Anex' })
  const [pw, setPw] = useState({ current_password: '', new_password: '' })
  const [msg, setMsg] = useState('')

  useEffect(() => {
    dashboardApi.settings().then((r) => setSettings(r.data)).catch(() => {})
  }, [])

  const saveSettings = async (e) => {
    e.preventDefault()
    await dashboardApi.updateSettings(settings)
    setMsg('Đã lưu cài đặt')
  }

  const changePw = async (e) => {
    e.preventDefault()
    try {
      await authApi.changePassword(pw.current_password, pw.new_password)
      setMsg('Đổi mật khẩu thành công')
      setPw({ current_password: '', new_password: '' })
    } catch (err) {
      setMsg(err.friendlyMessage || 'Lỗi đổi mật khẩu')
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-2xl font-black">⚙️ Cài đặt</h1>
      {msg && <p className="mt-2 text-arena-cyan">{msg}</p>}

      <form onSubmit={saveSettings} className="glass mt-4 space-y-3 rounded-2xl p-5">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.sound_enabled}
            onChange={(e) =>
              setSettings({ ...settings, sound_enabled: e.target.checked })
            }
          />
          🔊 Âm thanh ON/OFF
        </label>
        <div>
          <label className="text-sm">Tên hiển thị Admin</label>
          <input
            className="mt-1 w-full rounded-lg border border-arena-sky/30 bg-white px-3 py-2"
            value={settings.admin_display_name}
            onChange={(e) =>
              setSettings({ ...settings, admin_display_name: e.target.value })
            }
          />
        </div>
        <button type="submit" className="rounded-lg bg-arena-accent px-4 py-2 font-bold">
          Lưu
        </button>
      </form>

      <form onSubmit={changePw} className="glass mt-4 space-y-3 rounded-2xl p-5">
        <h2 className="font-bold">Đổi mật khẩu</h2>
        <input
          type="password"
          placeholder="Mật khẩu hiện tại"
          className="w-full rounded-lg border border-arena-sky/30 bg-white px-3 py-2"
          value={pw.current_password}
          onChange={(e) => setPw({ ...pw, current_password: e.target.value })}
          required
        />
        <input
          type="password"
          placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
          className="w-full rounded-lg border border-arena-sky/30 bg-white px-3 py-2"
          value={pw.new_password}
          onChange={(e) => setPw({ ...pw, new_password: e.target.value })}
          minLength={6}
          required
        />
        <button type="submit" className="rounded-lg bg-arena-sky/20 px-4 py-2 font-bold">
          Đổi mật khẩu
        </button>
      </form>
    </div>
  )
}
