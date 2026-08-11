import { useCallback, useEffect, useState } from 'react'
import { bankApi } from '../services/api'
import { questionTypeLabel } from './QuestionFormEditor'

const PAGE_SIZE = 15

/**
 * Modal to search bank questions and add selected ones into an exam.
 */
export default function BankPickerModal({ examId, onClose, onAdded }) {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
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

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const addSelected = async () => {
    if (!selected.size) {
      setError('Chọn ít nhất 1 câu hỏi')
      return
    }
    setSaving(true)
    setError('')
    try {
      await bankApi.addToExam(examId, [...selected])
      onAdded?.()
      onClose?.()
    } catch (err) {
      setError(err.friendlyMessage || 'Không thêm được vào bài thi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div className="glass flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl p-4 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-black">Thêm từ ngân hàng</h2>
            <p className="text-sm text-arena-ink/55">
              Tìm và chọn câu hỏi · đã chọn {selected.size}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-arena-sky/40 px-3 py-1 text-sm"
          >
            Đóng
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            setPage(1)
            setSearch(searchInput.trim())
          }}
          className="mt-3 flex flex-wrap gap-2"
        >
          <input
            className="min-w-[180px] flex-1 rounded-xl border border-arena-sky/30 bg-white px-3 py-2"
            placeholder="Tìm nội dung / tags..."
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
          <button
            type="submit"
            className="rounded-xl bg-arena-cyan/80 px-4 py-2 font-bold text-white"
          >
            Tìm
          </button>
        </form>

        <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
          {loading && <p className="text-sm text-arena-ink/50">Đang tải...</p>}
          {!loading &&
            items.map((q) => {
              const checked = selected.has(q.id)
              return (
                <label
                  key={q.id}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                    checked
                      ? 'border-arena-accent bg-arena-accent/10'
                      : 'border-arena-sky/25 bg-white/70'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    onChange={() => toggle(q.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-arena-ink/50">
                      {questionTypeLabel(q.question_type)}
                      {q.tags ? ` · ${q.tags}` : ''}
                    </p>
                    <p className="mt-0.5 text-sm font-medium whitespace-pre-wrap line-clamp-3">
                      {q.content}
                    </p>
                  </div>
                </label>
              )
            })}
          {!loading && !items.length && (
            <p className="text-sm text-arena-ink/50">
              Không có câu hỏi. Hãy tạo trong mục Ngân hàng câu hỏi.
            </p>
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-arena-sky/40 px-2 py-1 disabled:opacity-40"
            >
              ←
            </button>
            <span>
              {page}/{totalPages} · {total} câu
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded border border-arena-sky/40 px-2 py-1 disabled:opacity-40"
            >
              →
            </button>
          </div>
        )}

        {error && <p className="mt-2 text-sm text-arena-red">{error}</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving || !selected.size}
            onClick={addSelected}
            className="rounded-xl bg-arena-accent px-4 py-2 font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Đang thêm...' : `Thêm ${selected.size || ''} câu vào bài thi`}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-arena-cyan/40 px-4 py-2"
          >
            Hủy
          </button>
        </div>
      </div>
    </div>
  )
}
