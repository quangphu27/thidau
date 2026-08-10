import { getWsBase } from '../utils/config'

/**
 * WebSocket client with auto-reconnect and room state sync.
 */
export class RoomWebSocket {
  constructor(roomCode, { role = 'student', playerId = null, onMessage, onStatus } = {}) {
    this.roomCode = roomCode.toUpperCase()
    this.role = role
    this.playerId = playerId
    this.onMessage = onMessage || (() => {})
    this.onStatus = onStatus || (() => {})
    this.ws = null
    this.closed = false
    this.reconnectDelay = 1000
    this.pingTimer = null
  }

  connect() {
    if (this.closed) return
    const base = getWsBase()
    const params = new URLSearchParams({ role: this.role })
    if (this.playerId) params.set('player_id', this.playerId)
    const url = `${base}/ws/room/${this.roomCode}?${params}`
    this.onStatus('connecting')
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.reconnectDelay = 1000
      this.onStatus('connected')
      this.pingTimer = setInterval(() => {
        this.send({ type: 'ping' })
      }, 20000)
    }

    this.ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        this.onMessage(data)
      } catch {
        /* ignore */
      }
    }

    this.ws.onclose = () => {
      clearInterval(this.pingTimer)
      this.onStatus('disconnected')
      if (!this.closed) {
        setTimeout(() => this.connect(), this.reconnectDelay)
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 8000)
      }
    }

    this.ws.onerror = () => {
      try {
        this.ws?.close()
      } catch {
        /* ignore */
      }
    }
  }

  send(payload) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload))
    }
  }

  submitAnswer({ questionId, answerId, answerText }) {
    this.send({
      type: 'submit_answer',
      player_id: this.playerId,
      question_id: questionId,
      answer_id: answerId ?? null,
      answer_text: answerText ?? null,
    })
  }

  sendLobbyChat(text) {
    this.send({ type: 'lobby_chat', player_id: this.playerId, text })
  }

  sendLobbyAnnounce(text) {
    this.send({ type: 'lobby_announce', text })
  }

  sendLobbyAction(action, targetId = null) {
    this.send({
      type: 'lobby_action',
      player_id: this.playerId,
      action,
      target_id: targetId,
    })
  }

  sendLobbyMove(x, y) {
    this.send({ type: 'lobby_move', player_id: this.playerId, x, y })
  }

  setPlayerId(id) {
    this.playerId = id
  }

  close() {
    this.closed = true
    clearInterval(this.pingTimer)
    this.ws?.close()
  }
}
