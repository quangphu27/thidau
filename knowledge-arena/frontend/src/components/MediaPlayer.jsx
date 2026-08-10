import { mediaUrl } from '../utils/config'

export default function MediaPlayer({ mediaType, mediaUrl: url, className = '' }) {
  if (!url || !mediaType || mediaType === 'NONE') return null
  const src = mediaUrl(url)

  if (mediaType === 'IMAGE') {
    return (
      <img
        src={src}
        alt="Media"
        className={`max-h-64 w-full rounded-xl object-contain ${className}`}
      />
    )
  }
  if (mediaType === 'AUDIO') {
    return (
      <audio controls className={`w-full ${className}`} src={src}>
        Trình duyệt không hỗ trợ audio
      </audio>
    )
  }
  if (mediaType === 'VIDEO') {
    return (
      <video
        controls
        className={`max-h-72 w-full rounded-xl ${className}`}
        src={src}
      >
        Trình duyệt không hỗ trợ video
      </video>
    )
  }
  return null
}
