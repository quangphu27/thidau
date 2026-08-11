import { useCallback, useEffect, useState } from 'react'
import { bankApi } from '../../services/api'
import QuestionFormEditor, {
  buildQuestionPayload,
  defaultQuestionForm,
  formFromQuestion,
  questionTypeLabel,
} from '../../components/QuestionFormEditor'

const PAGE_SIZE = 20

export default function QuestionsBankPage() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(defaultQuestionForm())
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    bankApi
      .list({
        q: search || undefined,
        question_type: typeFilter || undefined,
        page,
        page_size: PAGE_SIZE,
      })
      .then((r) => {
        setItems(r.data.items || [])
        setTotal(r.data.total || 0)
      })
      .catch(() => {
        setItems([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [search, typeFilter, page])

  useEffect(() => {
    load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const openCreate = () => {
    setEditingId(null)
    setForm(defaultQuestionForm())
    setError('')
    setShowForm(true)
  }

  const openEdit = (q) => {
    setEditingId(q.id)
    setForm(formFromQuestion(q))
    setError('')
    setShowForm(true)
  }

  const save = async (e) => {
    e.preventDefault()
    setError('')
    const payload = buildQuestionPayload(form)
    if (form.question_type === 'ESSAY' && payload.options.length === 0) {
      setError('Vui lòng thêm ít nhất 1 đáp án đúng cho câu tự luận')
      return
    }
    if (form.question_type === 'BLOCK_PUZZLE' && !(form.blocks || []).length) {
      setError('Hãy xếp ít nhất 1 khối Scratch cho chương trình mẫu')
      return
    }
    try {
      if (editingId) {
        await bankApi.update(editingId, payload)
      } else {
        await bankApi.create(payload)
      }
      setShowForm(false)
      setEditingId(null)
      load()
    } catch (err) {
      setError(err.friendlyMessage || 'Lỗi lưu câu hỏi')
    }
  }

  const remove = async (id) => {
    if (!confirm('Xóa câu hỏi khỏi ngân hàng?')) return
    try {
      await bankApi.remove(id)
      load()
    } catch (err) {
      alert(err.friendlyMessage)
    }
  }

  const applySearch = (e) => {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black">Ngân hàng câu hỏi</h1>
          <p className="mt-1 text-sm text-arena-ink/55">
            Tạo câu hỏi dùng chung, rồi thêm vào bài thi khi cần · {total} câu
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-xl bg-arena-accent px-4 py-2 font-bold text-white"
        >
          + Thêm câu hỏi
        </button>
      </div>

      <form onSubmit={applySearch} className="mt-4 flex flex-wrap gap-2">
        <input
          className="min-w-[220px] flex-1 rounded-xl border border-arena-sky/30 bg-white px-3 py-2"
          placeholder="Tìm theo nội dung hoặc tags..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          className="rounded-xl border border-arena-sky/30 bg-white px-3 py-2"
          value={typeFilter}
          onChange={(e) => {
            setPage(1)
            setTypeFilter(e.target.value)
          }}
        >
          <option value="">Tất cả loại</option>
          <option value="MULTIPLE_CHOICE">Trắc nghiệm</option>
          <option value="ESSAY">Tự luận</option>
          <option value="BLOCK_PUZZLE">Thực hành Scratch</option>
        </select>
        <button type="submit" className="rounded-xl bg-arena-cyan/80 px-4 py-2 font-bold text-white">
          Tìm
        </button>
        {(search || typeFilter) && (
          <button
            type="button"
            className="rounded-xl border border-arena-sky/40 px-3 py-2 text-sm"
            onClick={() => {
              setSearchInput('')
              setSearch('')
              setTypeFilter('')
              setPage(1)
            }}
          >
            Xóa lọc
          </button>
        )}
      </form>

      {showForm && (
        <div className="mt-4 max-w-2xl">
          <QuestionFormEditor
            form={form}
            setForm={setForm}
            onSubmit={save}
            onCancel={() => {
              setShowForm(false)
              setEditingId(null)
            }}
            title={editingId ? 'Sửa câu hỏi ngân hàng' : 'Câu hỏi mới trong ngân hàng'}
            showTags
            error={error}
          />
        </div>
      )}

      <div className="mt-4 space-y-2">
        {loading && <p className="text-arena-ink/50">Đang tải...</p>}
        {!loading &&
          items.map((q) => (
            <div key={q.id} className="glass rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-arena-ink/50">
                    {questionTypeLabel(q.question_type)}
                    {q.tags ? ` · ${q.tags}` : ''}
                  </p>
                  <p className="mt-1 font-medium whitespace-pre-wrap">{q.content}</p>
                  {q.question_type === 'MULTIPLE_CHOICE' && (
                    <ul className="mt-2 space-y-0.5 text-sm text-arena-ink/65">
                      {q.options?.map((o, i) => (
                        <li key={o.id}>
                          {String.fromCharCode(65 + i)}. {o.content}{' '}
                          {o.is_correct && <span className="text-emerald-500">✓</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(q)}
                    className="rounded-lg bg-arena-sky/20 px-3 py-1.5 text-sm"
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(q.id)}
                    className="rounded-lg bg-red-500/20 px-3 py-1.5 text-sm text-arena-red"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </div>
          ))}
        {!loading && !items.length && (
          <p className="text-arena-ink/50">
            {search || typeFilter
              ? 'Không tìm thấy câu hỏi phù hợp.'
              : 'Chưa có câu hỏi trong ngân hàng. Hãy thêm câu hỏi mới.'}
          </p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-arena-sky/40 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            ← Trước
          </button>
          <span className="text-sm text-arena-ink/60">
            Trang {page}/{totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg border border-arena-sky/40 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Sau →
          </button>
        </div>
      )}
    </div>
  )
}
