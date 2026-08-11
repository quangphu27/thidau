import { mediaUrl } from '../utils/config'

const COLORS = [
  'bg-[#4cc9f0]',
  'bg-[#ff6b9d]',
  'bg-[#ffb703]',
  'bg-[#06d6a0]',
  'bg-[#9b5de5]',
  'bg-[#ff5a36]',
]

export default function AnswerOption({
  option,
  index,
  disabled,
  selected,
  eliminated = false,
  onSelect,
  large = false,
}) {
  const letter = String.fromCharCode(65 + index)
  const color = COLORS[index % COLORS.length]
  const blocked = disabled || eliminated

  return (
    <button
      type="button"
      disabled={blocked}
      onClick={() => {
        if (blocked) return
        onSelect(option)
      }}
      className={`answer-btn relative w-full rounded-3xl border-4 p-4 text-left md:p-5 ${
        eliminated
          ? 'border-stone-300 bg-stone-200/80 shadow-none'
          : selected
            ? 'border-arena-gold bg-arena-gold/25 shadow-[0_8px_0_#e09a00]'
            : 'border-white bg-white shadow-[0_8px_0_rgba(30,90,140,0.15)] hover:border-arena-sky'
      } ${blocked ? 'cursor-not-allowed' : 'cursor-pointer'} ${
        eliminated ? 'opacity-40 grayscale' : disabled ? 'opacity-55' : ''
      } ${large ? 'min-h-[92px]' : ''}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${color} font-display text-xl font-bold text-white shadow-md`}
        >
          {letter}
        </span>
        <div className="min-w-0 flex-1 pt-1">
          {option.content && (
            <p
              className={`font-bold text-arena-ink ${large ? 'text-lg md:text-xl' : ''} ${
                eliminated ? 'line-through decoration-2' : ''
              }`}
            >
              {option.content}
            </p>
          )}
          {option.media_type && option.media_type !== 'NONE' && option.media_url && (
            <div className="mt-2">
              {option.media_type === 'IMAGE' && (
                <img
                  src={option.media_url.startsWith('http') ? option.media_url : mediaUrl(option.media_url)}
                  alt=""
                  className="max-h-28 rounded-xl object-contain"
                />
              )}
              {option.media_type === 'AUDIO' && (
                <span className="text-sm font-bold text-arena-cyan">🔊 Âm thanh</span>
              )}
              {option.media_type === 'VIDEO' && (
                <span className="text-sm font-bold text-arena-pink">🎬 Video</span>
              )}
            </div>
          )}
        </div>
      </div>
      {eliminated && (
        <span className="absolute right-3 top-3 rounded-full bg-stone-500 px-2 py-0.5 text-[10px] font-black uppercase text-white">
          SAI
        </span>
      )}
    </button>
  )
}
