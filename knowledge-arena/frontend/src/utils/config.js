/**
 * Resolve API / WS base URLs for LAN without hardcoding localhost.
 * REST can use Vite proxy in DEV; WebSocket connects directly to backend :8000
 * (Vite WS proxy is unreliable and causes ECONNABORTED).
 */
export function getApiBase() {
  const env = import.meta.env.VITE_API_URL
  if (env && String(env).trim()) {
    return String(env).replace(/\/$/, '')
  }
  // Dev: relative URLs → Vite proxies /api and /media
  if (import.meta.env.DEV) {
    return ''
  }
  const { protocol, hostname } = window.location
  return `${protocol}//${hostname}:8000`
}

export function getWsBase() {
  const env = import.meta.env.VITE_WS_URL
  if (env && String(env).trim()) {
    return String(env).replace(/\/$/, '')
  }
  // Always hit backend directly — same host as the page (LAN-safe)
  const { hostname } = window.location
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${hostname}:8000`
}

export function mediaUrl(path) {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return `${getApiBase()}${path}`
}

export const ERROR_VI = {
  ROOM_NOT_FOUND: 'Không tìm thấy phòng thi',
  ROOM_ALREADY_STARTED: 'Phòng thi đã bắt đầu',
  ROOM_FINISHED: 'Phòng thi đã kết thúc',
  ROOM_NOT_RUNNING: 'Phòng thi chưa đang chạy',
  ROOM_PAUSED: 'Phòng thi đang tạm dừng',
  ALREADY_SUBMITTED: 'Bạn đã trả lời câu hỏi này rồi',
  QUESTION_ALREADY_ANSWERED: 'Đã có người trả lời câu hỏi này',
  QUESTION_EXPIRED: 'Đã hết thời gian trả lời',
  INVALID_ANSWER: 'Đáp án không hợp lệ',
  NOT_ALLOWED: 'Không được phép thực hiện',
  PLAYER_NOT_FOUND: 'Không tìm thấy người chơi',
  EXAM_NOT_FOUND: 'Không tìm thấy bài thi',
  EXAM_IN_USE: 'Không thể sửa bài thi đang chạy',
  QUESTION_NOT_FOUND: 'Không tìm thấy câu hỏi',
  NO_QUESTIONS: 'Bài thi chưa có câu hỏi',
  INVALID_CREDENTIALS: 'Sai tên đăng nhập hoặc mật khẩu',
  NAME_REQUIRED: 'Vui lòng nhập tên',
  NAME_TOO_LONG: 'Tên quá dài (tối đa 50 ký tự)',
  WRONG_QUESTION: 'Đây không phải câu hỏi hiện tại',
  GAME_NOT_STARTED: 'Cuộc thi chưa bắt đầu',
  NO_MORE_QUESTIONS: 'Đã hết câu hỏi',
  LOBBY_CLOSED: 'Phòng chờ đã đóng (thi đấu đã bắt đầu)',
  COOLDOWN: 'Chờ một chút rồi chơi tiếp nhé!',
}

export function errorMessage(code) {
  return ERROR_VI[code] || code || 'Đã xảy ra lỗi'
}
