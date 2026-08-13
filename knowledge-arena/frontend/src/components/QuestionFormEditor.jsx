import { useState } from 'react'
import { uploadApi } from '../services/api'
import ScratchBlockBuilder from './ScratchBlockBuilder'
import MediaPlayer from './MediaPlayer'

export function questionTypeLabel(t) {
  if (t === 'ESSAY') return 'Tự luận'
  if (t === 'BLOCK_PUZZLE') return 'Thực hành Scratch'
  return 'Trắc nghiệm'
}

export const emptyOption = (i) => ({
  content: '',
  is_correct: i === 0,
  media_type: 'NONE',
  media_url: null,
  order_index: i,
})

export const defaultQuestionForm = () => ({
  content: '',
  question_type: 'MULTIPLE_CHOICE',
  media_type: 'NONE',
  media_url: null,
  media_position: 'BEFORE',
  tags: '',
  points: 10,
  input_mode: 'TEXT',
  blocks: [],
  options: [emptyOption(0), emptyOption(1), emptyOption(2), emptyOption(3)],
})

export function formFromQuestion(q) {
  return {
    content: q.content || '',
    question_type: q.question_type || 'MULTIPLE_CHOICE',
    media_type: q.media_type || 'NONE',
    media_url: q.media_url,
    media_position: q.media_position || 'BEFORE',
    tags: q.tags || '',
    points: q.points || 10,
    input_mode: q.input_mode || 'TEXT',
    blocks: parseBlocks(q.blocks_json),
    options: q.options?.length
      ? q.options.map((o, i) => ({
          content: o.content,
          is_correct: o.is_correct,
          media_type: o.media_type || 'NONE',
          media_url: o.media_url,
          order_index: i,
        }))
      : [emptyOption(0), emptyOption(1)],
  }
}

function parseBlocks(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (Array.isArray(data)) return data
    return data?.script || []
  } catch {
    return []
  }
}

export function buildQuestionPayload(form) {
  const isPuzzle = form.question_type === 'BLOCK_PUZZLE'
  return {
    content: form.content,
    question_type: form.question_type,
    media_type: form.media_type,
    media_url: form.media_url,
    media_position: form.media_position,
    tags: form.tags || '',
    points: Number(form.points) || (isPuzzle ? 20 : 10),
    input_mode: form.question_type === 'ESSAY' ? form.input_mode || 'TEXT' : 'TEXT',
    blocks_json: isPuzzle ? JSON.stringify({ script: form.blocks || [] }) : null,
    options:
      form.question_type === 'ESSAY'
        ? form.options
            .filter((o) => (o.content || '').trim())
            .map((o, i) => ({
              content: o.content.trim(),
              is_correct: true,
              media_type: 'NONE',
              media_url: null,
              order_index: i,
            }))
        : isPuzzle
          ? []
          : form.options.map((o, i) => ({ ...o, order_index: i })),
  }
}

/**
 * Shared create/edit form for exam questions and bank questions.
 */
export default function QuestionFormEditor({
  form,
  setForm,
  onSubmit,
  onCancel,
  title = 'Câu hỏi',
  showTags = false,
  error = '',
  submitLabel = 'Lưu',
}) {
  const [uploading, setUploading] = useState(false)

  const uploadMedia = async (file, target = 'question', optIndex = 0) => {
    setUploading(true)
    try {
      const { data } = await uploadApi.upload(file)
      if (target === 'question') {
        setForm((f) => ({ ...f, media_type: data.media_type, media_url: data.url }))
      } else {
        setForm((f) => {
          const options = [...f.options]
          options[optIndex] = {
            ...options[optIndex],
            media_type: data.media_type,
            media_url: data.url,
          }
          return { ...f, options }
        })
      }
    } catch (err) {
      alert(err.friendlyMessage || 'Upload thất bại')
    } finally {
      setUploading(false)
    }
  }

  const addOption = () => {
    setForm((f) => ({
      ...f,
      options: [...f.options, emptyOption(f.options.length)],
    }))
  }

  return (
    <form onSubmit={onSubmit} className="glass space-y-3 rounded-2xl p-5">
      <h2 className="font-bold">{title}</h2>
      <textarea
        required
        rows={3}
        className="w-full rounded-lg border border-arena-sky/30 bg-white px-3 py-2"
        placeholder="Nội dung câu hỏi"
        value={form.content}
        onChange={(e) => setForm({ ...form, content: e.target.value })}
      />
      {showTags && (
        <div>
          <label className="text-sm text-arena-ink/50">Tags (tìm kiếm dễ hơn)</label>
          <input
            className="mt-1 w-full rounded-lg border border-arena-sky/30 bg-white px-3 py-2"
            placeholder="VD: toán, lớp 3, hình học"
            value={form.tags || ''}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
          />
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <select
          className="rounded-lg border border-arena-sky/30 bg-white px-3 py-2"
          value={form.question_type}
          onChange={(e) => {
            const t = e.target.value
            if (t === 'ESSAY') {
              setForm({
                ...form,
                question_type: t,
                options: form.options?.length
                  ? form.options
                  : [
                      {
                        content: '',
                        is_correct: true,
                        media_type: 'NONE',
                        media_url: null,
                        order_index: 0,
                      },
                    ],
              })
            } else if (t === 'BLOCK_PUZZLE') {
              setForm({
                ...form,
                question_type: t,
                points: form.points || 20,
                blocks: form.blocks?.length ? form.blocks : [],
                options: [],
              })
            } else {
              setForm({
                ...form,
                question_type: t,
                options:
                  form.options?.length >= 2
                    ? form.options
                    : [emptyOption(0), emptyOption(1), emptyOption(2), emptyOption(3)],
              })
            }
          }}
        >
          <option value="MULTIPLE_CHOICE">Trắc nghiệm</option>
          <option value="ESSAY">Tự luận</option>
          <option value="BLOCK_PUZZLE">Thực hành Scratch (ghép khối)</option>
        </select>
        <select
          className="rounded-lg border border-arena-sky/30 bg-white px-3 py-2"
          value={form.media_position}
          onChange={(e) => setForm({ ...form, media_position: e.target.value })}
        >
          <option value="BEFORE">Media trước câu hỏi</option>
          <option value="AFTER">Media sau câu hỏi</option>
        </select>
      </div>
      <div>
        <label className="text-sm text-arena-ink/50">Media câu hỏi (ảnh / mp3·wav·ogg / mp4·webm)</label>
        <input
          type="file"
          accept="image/*,audio/*,video/*,.mp3,.wav,.ogg,.m4a,.mp4,.webm"
          disabled={uploading}
          className="mt-1 block w-full text-sm"
          onChange={(e) => e.target.files?.[0] && uploadMedia(e.target.files[0])}
        />
        {form.media_url && (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-arena-cyan">
              <span>
                {form.media_type}: {form.media_url}
              </span>
              <button
                type="button"
                className="rounded bg-red-500/15 px-2 py-0.5 font-bold text-arena-red"
                onClick={() =>
                  setForm({ ...form, media_type: 'NONE', media_url: null })
                }
              >
                Xóa media
              </button>
            </div>
            <MediaPlayer mediaType={form.media_type} mediaUrl={form.media_url} compact />
          </div>
        )}
      </div>

      <div>
        <label className="text-sm text-arena-ink/50">Điểm khi đúng</label>
        <input
          type="number"
          min={1}
          max={100}
          className="ml-2 w-20 rounded border border-arena-sky/30 bg-white px-2 py-1"
          value={form.points || 10}
          onChange={(e) => setForm({ ...form, points: Number(e.target.value) || 10 })}
        />
      </div>

      {form.question_type === 'BLOCK_PUZZLE' && (
        <ScratchBlockBuilder
          script={form.blocks || []}
          onChange={(blocks) => setForm({ ...form, blocks })}
        />
      )}

      {form.question_type === 'MULTIPLE_CHOICE' && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Đáp án</p>
          {form.options.map((opt, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-arena-sky/10 p-2">
              <span className="font-bold text-arena-gold">{String.fromCharCode(65 + i)}</span>
              <input
                className="min-w-[140px] flex-1 rounded border border-arena-sky/30 bg-white px-2 py-1"
                value={opt.content}
                onChange={(e) => {
                  const options = [...form.options]
                  options[i] = { ...options[i], content: e.target.value }
                  setForm({ ...form, options })
                }}
                placeholder="Nội dung đáp án"
              />
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  name="correct"
                  checked={opt.is_correct}
                  onChange={() => {
                    const options = form.options.map((o, j) => ({
                      ...o,
                      is_correct: j === i,
                    }))
                    setForm({ ...form, options })
                  }}
                />
                Đúng
              </label>
              <input
                type="file"
                accept="image/*,audio/*,video/*"
                className="max-w-[140px] text-xs"
                onChange={(e) =>
                  e.target.files?.[0] && uploadMedia(e.target.files[0], 'option', i)
                }
              />
            </div>
          ))}
          <button type="button" onClick={addOption} className="text-sm text-arena-cyan">
            + Thêm đáp án
          </button>
        </div>
      )}

      {form.question_type === 'ESSAY' && (
        <div>
          <label className="text-sm text-arena-ink/50">Kiểu nhập</label>
          <select
            className="ml-2 rounded border border-arena-sky/30 bg-white px-2 py-1"
            value={form.input_mode || 'TEXT'}
            onChange={(e) => setForm({ ...form, input_mode: e.target.value })}
          >
            <option value="TEXT">Chữ</option>
            <option value="NUMBER">Số (sai được nhập lại sau 10s)</option>
          </select>
        </div>
      )}

      {form.question_type === 'ESSAY' && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Danh sách đáp án đúng (tự động chấm)</p>
          <p className="text-xs text-arena-ink/50">
            {form.input_mode === 'NUMBER'
              ? 'Học sinh nhập số trùng đáp án → được điểm; sai thì đợi 10 giây rồi nhập lại.'
              : 'Học sinh nhập trùng một trong các đáp án này (không phân biệt hoa/thường) → được điểm.'}
          </p>
          {form.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-arena-gold">#{i + 1}</span>
              <input
                className="flex-1 rounded border border-arena-sky/30 bg-white px-2 py-1.5"
                value={opt.content}
                onChange={(e) => {
                  const options = [...form.options]
                  options[i] = { ...options[i], content: e.target.value, is_correct: true }
                  setForm({ ...form, options })
                }}
                placeholder='VD: print("Xin chào")'
              />
              <button
                type="button"
                className="rounded bg-red-500/20 px-2 py-1 text-xs text-arena-red"
                onClick={() => {
                  if (form.options.length <= 1) return
                  setForm({
                    ...form,
                    options: form.options.filter((_, j) => j !== i),
                  })
                }}
              >
                Xóa
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setForm({
                ...form,
                options: [
                  ...form.options,
                  {
                    content: '',
                    is_correct: true,
                    media_type: 'NONE',
                    media_url: null,
                    order_index: form.options.length,
                  },
                ],
              })
            }
            className="text-sm text-arena-cyan"
          >
            + Thêm đáp án đúng
          </button>
        </div>
      )}

      {error && <p className="text-sm text-arena-red">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="rounded-lg bg-arena-accent px-4 py-2 font-bold text-white">
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-arena-cyan/40 px-4 py-2"
        >
          Hủy
        </button>
      </div>
    </form>
  )
}
