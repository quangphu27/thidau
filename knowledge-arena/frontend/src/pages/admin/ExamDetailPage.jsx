import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import BankPickerModal from '../../components/BankPickerModal'
import QuestionFormEditor, {
  buildQuestionPayload,
  defaultQuestionForm,
  formFromQuestion,
  questionTypeLabel,
} from '../../components/QuestionFormEditor'
import { examApi, questionApi } from '../../services/api'

export default function ExamDetailPage() {
  const { id } = useParams()
  const [exam, setExam] = useState(null)
  const [showQ, setShowQ] = useState(false)
  const [showBank, setShowBank] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showExamEdit, setShowExamEdit] = useState(false)
  const [examForm, setExamForm] = useState({
    title: '',
    description: '',
    time_per_question: 15,
  })
  const [examError, setExamError] = useState('')
  const [examSaving, setExamSaving] = useState(false)
  const [form, setForm] = useState(defaultQuestionForm())
  const [error, setError] = useState('')

  const load = () =>
    examApi
      .get(id)
      .then((r) => {
        setExam(r.data)
        setExamForm({
          title: r.data.title || '',
          description: r.data.description || '',
          time_per_question: r.data.time_per_question || 15,
        })
      })
      .catch(() => {})

  useEffect(() => {
    load()
  }, [id])

  const saveExamMeta = async (e) => {
    e.preventDefault()
    setExamError('')
    setExamSaving(true)
    try {
      await examApi.update(id, {
        title: examForm.title.trim(),
        description: examForm.description || '',
        time_per_question: Number(examForm.time_per_question) || 15,
      })
      setShowExamEdit(false)
      load()
    } catch (err) {
      setExamError(
        err.friendlyMessage ||
          'Không thể cập nhật bài thi (có thể đang có phòng thi dùng bài này)',
      )
    } finally {
      setExamSaving(false)
    }
  }

  const resetForm = () => {
    setForm(defaultQuestionForm())
    setEditing(null)
    setShowQ(false)
    setError('')
  }

  const openEdit = (q) => {
    setEditing(q.id)
    setForm(formFromQuestion(q))
    setShowQ(true)
  }

  const save = async (e) => {
    e.preventDefault()
    setError('')
    const payload = {
      ...buildQuestionPayload(form),
      exam_id: Number(id),
      order_index: editing
        ? (exam.questions.find((q) => q.id === editing)?.order_index ?? exam.questions.length)
        : exam.questions.length,
    }
    if (form.question_type === 'ESSAY' && payload.options.length === 0) {
      setError('Vui lòng thêm ít nhất 1 đáp án đúng cho câu tự luận')
      return
    }
    if (form.question_type === 'BLOCK_PUZZLE' && !(form.blocks || []).length) {
      setError('Hãy xếp ít nhất 1 khối Scratch cho chương trình mẫu')
      return
    }
    try {
      if (editing) {
        await questionApi.update(editing, payload)
      } else {
        await questionApi.create(payload)
      }
      resetForm()
      load()
    } catch (err) {
      setError(err.friendlyMessage || 'Lỗi lưu câu hỏi')
    }
  }

  const removeQ = async (qid) => {
    if (!confirm('Xóa câu hỏi?')) return
    try {
      await questionApi.remove(qid)
      load()
    } catch (err) {
      alert(err.friendlyMessage)
    }
  }

  if (!exam) return <p>Đang tải...</p>

  return (
    <div>
      <Link to="/admin/exams" className="text-sm text-arena-ink/50 hover:text-arena-ink">
        ← Bài thi
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black">{exam.title}</h1>
          {exam.description && (
            <p className="mt-1 text-sm text-arena-ink/60">{exam.description}</p>
          )}
          <p className="mt-1 text-arena-ink/50">
            {exam.question_count} câu · {exam.time_per_question}s/câu
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setExamForm({
              title: exam.title || '',
              description: exam.description || '',
              time_per_question: exam.time_per_question || 15,
            })
            setExamError('')
            setShowExamEdit(true)
          }}
          className="rounded-xl bg-arena-gold/40 px-4 py-2 font-bold"
        >
          Sửa thông tin bài thi
        </button>
      </div>

      {showExamEdit && (
        <form onSubmit={saveExamMeta} className="glass mt-4 max-w-lg space-y-3 rounded-2xl p-5">
          <h2 className="font-bold">Chỉnh sửa bài thi</h2>
          <div>
            <label className="text-sm font-semibold">Tên bài thi</label>
            <input
              required
              className="mt-1 w-full rounded-lg border border-arena-sky/30 bg-white px-3 py-2"
              value={examForm.title}
              onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-semibold">Mô tả</label>
            <textarea
              rows={3}
              className="mt-1 w-full rounded-lg border border-arena-sky/30 bg-white px-3 py-2"
              value={examForm.description}
              onChange={(e) => setExamForm({ ...examForm, description: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-semibold">Thời gian mỗi câu (giây)</label>
            <input
              type="number"
              min={5}
              max={300}
              required
              className="mt-1 w-full rounded-lg border border-arena-sky/30 bg-white px-3 py-2"
              value={examForm.time_per_question}
              onChange={(e) =>
                setExamForm({ ...examForm, time_per_question: Number(e.target.value) })
              }
            />
          </div>
          {examError && <p className="text-sm text-arena-red">{examError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={examSaving}
              className="rounded-lg bg-arena-accent px-4 py-2 font-bold text-white disabled:opacity-60"
            >
              {examSaving ? 'Đang lưu...' : 'Cập nhật'}
            </button>
            <button
              type="button"
              onClick={() => setShowExamEdit(false)}
              className="rounded-lg border border-arena-cyan/40 px-4 py-2"
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            resetForm()
            setShowQ(true)
          }}
          className="rounded-xl bg-arena-accent px-4 py-2 font-bold text-white"
        >
          + Thêm câu hỏi mới
        </button>
        <button
          type="button"
          onClick={() => setShowBank(true)}
          className="rounded-xl bg-arena-cyan px-4 py-2 font-bold text-white"
        >
          + Từ ngân hàng
        </button>
        <Link
          to="/admin/questions"
          className="rounded-xl border border-arena-sky/40 px-4 py-2 text-sm font-semibold"
        >
          Quản lý ngân hàng →
        </Link>
      </div>

      {showQ && (
        <div className="mt-4 max-w-2xl">
          <QuestionFormEditor
            form={form}
            setForm={setForm}
            onSubmit={save}
            onCancel={resetForm}
            title={editing ? 'Sửa câu hỏi' : 'Câu hỏi mới'}
            error={error}
          />
        </div>
      )}

      {showBank && (
        <BankPickerModal
          examId={Number(id)}
          onClose={() => setShowBank(false)}
          onAdded={load}
        />
      )}

      <div className="mt-6 space-y-3">
        {exam.questions?.map((q, idx) => (
          <div key={q.id} className="glass rounded-2xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-arena-gold">
                  Câu {idx + 1} · {questionTypeLabel(q.question_type)} · {q.points || 10} điểm
                </span>
                <p className="mt-1 font-medium whitespace-pre-wrap">{q.content}</p>
                {q.question_type === 'MULTIPLE_CHOICE' && (
                  <ul className="mt-2 space-y-1 text-sm text-arena-ink/70">
                    {q.options?.map((o, i) => (
                      <li key={o.id}>
                        {String.fromCharCode(65 + i)}. {o.content}{' '}
                        {o.is_correct && <span className="text-emerald-400">✓</span>}
                      </li>
                    ))}
                  </ul>
                )}
                {q.question_type === 'BLOCK_PUZZLE' && (
                  <p className="mt-2 text-xs font-bold text-arena-cyan">
                    Học sinh ghép khối lộn xộn + điền số
                  </p>
                )}
                {q.question_type === 'ESSAY' && (
                  <ul className="mt-2 space-y-1 text-sm text-emerald-300/90">
                    <li className="text-xs text-arena-ink/50">Đáp án đúng chấp nhận:</li>
                    {q.options?.map((o) => (
                      <li key={o.id}>✓ {o.content}</li>
                    ))}
                    {!q.options?.length && (
                      <li className="text-amber-300">Chưa có đáp án — cần bổ sung</li>
                    )}
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
                  onClick={() => removeQ(q.id)}
                  className="rounded-lg bg-red-500/20 px-3 py-1.5 text-sm text-arena-red"
                >
                  Xóa
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
