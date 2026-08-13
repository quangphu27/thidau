import { useEffect, useRef, useState } from 'react'
import { mediaUrl } from '../utils/config'

/**
 * Renders question/option IMAGE | AUDIO | VIDEO with replay controls.
 */
export default function MediaPlayer({
  mediaType,
  mediaUrl: url,
  className = '',
  autoPlay = false,
  compact = false,
}) {
  const ref = useRef(null)
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(false)

  const type = String(mediaType || '').toUpperCase()
  const src = url ? mediaUrl(url) : ''

  useEffect(() => {
    setError('')
    setPlaying(false)
  }, [src, type])

  if (!src || !type || type === 'NONE') return null

  const replay = async () => {
    const el = ref.current
    if (!el) return
    try {
      el.currentTime = 0
      await el.play()
      setPlaying(true)
      setError('')
    } catch {
      setError('Không phát được — bấm Play trên thanh điều khiển')
    }
  }

  if (type === 'IMAGE') {
    return (
      <div className={className}>
        <img
          src={src}
          alt="Media câu hỏi"
          className={`w-full rounded-xl object-contain ${compact ? 'max-h-36' : 'max-h-72'}`}
          onError={() => setError('Không tải được ảnh')}
        />
        {error && <p className="mt-1 text-sm font-bold text-arena-red">{error}</p>}
      </div>
    )
  }

  if (type === 'AUDIO') {
    return (
      <div
        className={`rounded-2xl border-2 border-arena-cyan/40 bg-arena-sky/10 p-3 ${className}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <p className="mb-2 text-xs font-black uppercase tracking-wide text-arena-cyan">
          Âm thanh
        </p>
        <audio
          ref={ref}
          key={src}
          controls
          preload="auto"
          autoPlay={autoPlay}
          className="w-full"
          src={src}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => setError('Không tải được file âm thanh (kiểm tra định dạng mp3/wav/ogg)')}
        >
          Trình duyệt không hỗ trợ audio
        </audio>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={replay}
            className="rounded-full bg-arena-cyan px-3 py-1.5 text-sm font-black text-white"
          >
            {playing ? 'Nghe lại từ đầu' : 'Phát / Nghe lại'}
          </button>
        </div>
        {error && <p className="mt-1 text-sm font-bold text-arena-red">{error}</p>}
        {!error && (
          <p className="mt-1 text-[11px] text-arena-ink/45">
            Nếu không nghe thấy, bấm «Phát / Nghe lại» hoặc Play trên thanh audio
          </p>
        )}
      </div>
    )
  }

  if (type === 'VIDEO') {
    return (
      <div
        className={`rounded-2xl border-2 border-arena-pink/30 bg-black/5 p-2 ${className}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <p className="mb-2 px-1 text-xs font-black uppercase tracking-wide text-arena-pink">
          Video
        </p>
        <video
          ref={ref}
          key={src}
          controls
          preload="auto"
          playsInline
          autoPlay={autoPlay}
          className={`w-full rounded-xl ${compact ? 'max-h-40' : 'max-h-80'}`}
          src={src}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => setError('Không tải được video (kiểm tra định dạng mp4/webm)')}
        >
          Trình duyệt không hỗ trợ video
        </video>
        <div className="mt-2 flex flex-wrap gap-2 px-1">
          <button
            type="button"
            onClick={replay}
            className="rounded-full bg-arena-pink px-3 py-1.5 text-sm font-black text-white"
          >
            {playing ? 'Xem lại từ đầu' : 'Phát / Xem lại'}
          </button>
        </div>
        {error && <p className="mt-1 px-1 text-sm font-bold text-arena-red">{error}</p>}
      </div>
    )
  }

  return (
    <p className="text-sm font-bold text-amber-600">
      Media không hỗ trợ: {type}
    </p>
  )
}
