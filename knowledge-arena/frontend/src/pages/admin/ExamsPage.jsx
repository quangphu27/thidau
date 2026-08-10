import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { examApi } from '../../services/api'

const emptyForm = { title: '', description: '', time_per_question: 15 }

export default function ExamsPage() {
  const [exams, setExams] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => examApi.list().then((r) => setExams(r.data)).catch(() => {})

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setShowForm(true)
  }

  const openEdit = (ex) => {
    setEditingId(ex.id)
    setForm({
      title: ex.title || '',
      description: ex.description || '',
      time_per_question: ex.time_per_question || 15,
    })
    setError('')
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
    setError('')
  }

  const save = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description || '',
        time_per_question: Number(form.time_per_question) || 15,
      }
      if (editingId) {
        await examApi.update(editingId, payload)
      } else {
        await examApi.create(payload)
      }
      closeForm()
      load()
    } catch (err) {
      setError(err.friendlyMessage || (editingId ? 'Lỗi cập nhật bài thi' : 'Lỗi tạo bài thi'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    if (!confirm('Xóa bài thi này?')) return
    try {
      await examApi.remove(id)
      load()
    } catch (err) {
      alert(err.friendlyMessage || 'Không thể xóa')
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-black">📝 Bài thi</h1>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-xl bg-arena-accent px-4 py-2 font-bold text-white"
        >
          + Tạo bài thi
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="glass mt-4 max-w-lg rounded-2xl p-5">
          <h2 className="font-bold">
            {editingId ? '✏️ Chỉnh sửa bài thi' : 'Tạo bài thi mới'}
          </h2>
          <label className="mt-3 block text-sm font-semibold">Tên bài thi</label>
          <input
            required
            className="mt-1 w-full rounded-lg border border-arena-sky/30 bg-white px-3 py-2"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Đấu trường Python lớp 7"
          />
          <label className="mt-3 block text-sm font-semibold">Mô tả</label>
          <textarea
            rows={3}
            className="mt-1 w-full rounded-lg border border-arena-sky/30 bg-white px-3 py-2"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Mô tả ngắn về bài thi..."
          />
          <label className="mt-3 block text-sm font-semibold">
            Thời gian mỗi câu (giây)
          </label>
          <input
            type="number"
            min={5}
            max={300}
            required
            className="mt-1 w-full rounded-lg border border-arena-sky/30 bg-white px-3 py-2"
            value={form.time_per_question}
            onChange={(e) =>
              setForm({ ...form, time_per_question: Number(e.target.value) })
            }
          />
          {error && <p className="mt-2 text-sm text-arena-red">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-arena-accent px-4 py-2 font-bold text-white disabled:opacity-60"
            >
              {saving ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Lưu'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border border-arena-cyan/40 px-4 py-2 font-semibold"
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 grid gap-3">
        {exams.map((ex) => (
          <div
            key={ex.id}
            className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
          >
            <div>
              <h3 className="text-lg font-bold">{ex.title}</h3>
              {ex.description && (
                <p className="mt-0.5 text-sm text-arena-ink/60 line-clamp-2">
                  {ex.description}
                </p>
              )}
              <p className="mt-1 text-sm text-arena-ink/50">
                {ex.question_count} câu · {ex.time_per_question}s/câu
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openEdit(ex)}
                className="rounded-lg bg-arena-gold/30 px-3 py-2 text-sm font-semibold"
              >
                Sửa
              </button>
              <Link
                to={`/admin/exams/${ex.id}`}
                className="rounded-lg bg-arena-sky/20 px-3 py-2 text-sm font-semibold"
              >
                Quản lý câu hỏi
              </Link>
              <button
                type="button"
                onClick={() => remove(ex.id)}
                className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-arena-red"
              >
                Xóa
              </button>
            </div>
          </div>
        ))}
        {!exams.length && (
          <p className="text-arena-ink/50">Chưa có bài thi. Hãy tạo bài thi đầu tiên!</p>
        )}
      </div>
    </div>
  )
}
