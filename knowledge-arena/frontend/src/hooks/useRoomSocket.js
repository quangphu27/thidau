import { useEffect, useRef, useState, useCallback } from 'react'
import { RoomWebSocket } from '../websocket/RoomWebSocket'

export function useRoomSocket(roomCode, { role = 'student', playerId = null, enabled = true } = {}) {
  const [status, setStatus] = useState('idle')
  const [lastEvent, setLastEvent] = useState(null)
  const [roomState, setRoomState] = useState(null)
  const [question, setQuestion] = useState(null)
  const [rankings, setRankings] = useState([])
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [toast, setToast] = useState(null)
  const [finished, setFinished] = useState(null)
  const [battleEvent, setBattleEvent] = useState(null)
  const [autoNext, setAutoNext] = useState(null)
  const [lobbyMessages, setLobbyMessages] = useState([])
  const [lobbyFx, setLobbyFx] = useState(null)
  const [lobbyPositions, setLobbyPositions] = useState({})
  const wsRef = useRef(null)

  const pushLobby = useCallback((item) => {
    setLobbyMessages((prev) => {
      const next = [...prev, item]
      return next.length > 100 ? next.slice(-100) : next
    })
  }, [])

  const handleMessage = useCallback((data) => {
    setLastEvent(data)
    switch (data.type) {
      case 'room_updated':
      case 'player_joined':
      case 'player_left':
        setRoomState((prev) => ({ ...prev, ...data }))
        if (data.rankings) setRankings(data.rankings)
        if (data.already_submitted) setAlreadySubmitted(true)
        if (data.type === 'player_left' && data.player_id) {
          setLobbyPositions((prev) => {
            if (!prev[data.player_id]) return prev
            const next = { ...prev }
            delete next[data.player_id]
            return next
          })
        }
        break
      case 'game_started':
        setRoomState((prev) => ({ ...prev, ...data }))
        if (data.rankings) setRankings(data.rankings)
        setLobbyMessages([])
        setLobbyFx(null)
        setLobbyPositions({})
        break
      case 'lobby_history':
        setLobbyMessages(Array.isArray(data.items) ? data.items : [])
        break
      case 'lobby_positions':
        setLobbyPositions(data.positions || {})
        break
      case 'lobby_move':
        if (data.player_id) {
          setLobbyPositions((prev) => ({
            ...prev,
            [data.player_id]: { x: data.x, y: data.y },
          }))
        }
        break
      case 'lobby_chat':
        pushLobby(data)
        break
      case 'lobby_announce':
        pushLobby(data)
        setToast({
          kind: 'announce',
          title: 'Thông báo từ Admin',
          message: data.text,
        })
        break
      case 'lobby_action':
        pushLobby({
          ...data,
          text:
            data.action === 'brick'
              ? `${data.from_name} ném gạch vào ${data.target_name}!`
              : `${data.from_name} Solo kill ${data.target_name}!`,
        })
        setLobbyFx({ ...data, at: Date.now() })
        break
      case 'answer_correct':
        setToast({
          kind: 'correct',
          title: data.player_name,
          message: data.message || `🎉 Bạn ${data.player_name} đã trả lời đúng!`,
          points: data.points,
          answer_display: data.answer_display,
        })
        setRoomState((prev) => ({ ...prev, question_answered: true }))
        setBattleEvent({
          kind: 'correct',
          player_id: data.player_id,
          player_name: data.player_name,
          effect_ms: data.effect_ms ?? 2200,
          countdown_seconds: data.countdown_seconds ?? 3,
          auto_next: data.auto_next !== false,
          at: Date.now(),
        })
        setAutoNext({
          winnerName: data.player_name,
          effectMs: data.effect_ms ?? 2200,
          countdownSeconds: data.countdown_seconds ?? 3,
          at: Date.now(),
        })
        break
      case 'answer_wrong':
        setToast({
          kind: 'wrong',
          title: 'Rất tiếc!',
          message: data.message || '❌ Bạn đã trả lời sai.',
          points: data.points ?? -10,
          answer_display: data.answer_display,
          score: data.score,
        })
        setAlreadySubmitted(true)
        setBattleEvent({
          kind: 'wrong',
          player_id: data.player_id || playerId,
          player_name: data.player_name || null,
          at: Date.now(),
        })
        break
      case 'answer_received':
        setToast({
          kind: data.is_correct === false ? 'locked-wrong' : 'locked',
          title: data.player_name || 'Đã chốt',
          message: data.message,
          points: data.points,
          answer_display: data.answer_display,
        })
        if (data.question_locked) {
          setRoomState((prev) => ({ ...prev, question_answered: true }))
        }
        if (data.locked && data.player_id === playerId) {
          setAlreadySubmitted(true)
        }
        if (data.is_correct === false && data.player_id) {
          setBattleEvent({
            kind: 'wrong',
            player_id: data.player_id,
            player_name: data.player_name,
            at: Date.now(),
          })
        }
        break
      case 'question_started':
        setQuestion(data.question)
        setAlreadySubmitted(!!data.already_submitted)
        setToast(null)
        setBattleEvent(null)
        setAutoNext(null)
        setRoomState((prev) => ({
          ...prev,
          status: 'RUNNING',
          question_answered: data.question_answered,
        }))
        break
      case 'score_updated':
        if (data.rankings) setRankings(data.rankings)
        setRoomState((prev) => ({
          ...prev,
          question_answered:
            data.question_answered === true
              ? true
              : data.question_answered === false
                ? false
                : prev?.question_answered,
          rankings: data.rankings || prev?.rankings,
        }))
        break
      case 'question_finished':
        break
      case 'game_finished':
        setFinished(data)
        setRankings(data.rankings || [])
        setAutoNext(null)
        break
      case 'error':
        setToast({
          kind: 'error',
          title: 'Thông báo',
          message: data.message || data.code,
          code: data.code,
        })
        if (data.code === 'ALREADY_SUBMITTED') {
          setAlreadySubmitted(true)
        }
        if (data.code === 'QUESTION_ALREADY_ANSWERED') {
          setRoomState((prev) => ({ ...prev, question_answered: true }))
        }
        break
      case 'joined':
        break
      default:
        break
    }
  }, [playerId, pushLobby])

  useEffect(() => {
    if (!enabled || !roomCode) return undefined
    const ws = new RoomWebSocket(roomCode, {
      role,
      playerId,
      onMessage: handleMessage,
      onStatus: setStatus,
    })
    wsRef.current = ws
    ws.connect()
    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [roomCode, role, playerId, enabled, handleMessage])

  const submitAnswer = useCallback((payload) => {
    setAlreadySubmitted(true)
    wsRef.current?.submitAnswer(payload)
  }, [])

  const sendLobbyChat = useCallback((text) => {
    wsRef.current?.sendLobbyChat(text)
  }, [])

  const sendLobbyAnnounce = useCallback((text) => {
    wsRef.current?.sendLobbyAnnounce(text)
  }, [])

  const sendLobbyAction = useCallback((action, targetId = null) => {
    wsRef.current?.sendLobbyAction(action, targetId)
  }, [])

  const sendLobbyMove = useCallback((pos) => {
    if (!pos) return
    wsRef.current?.sendLobbyMove(pos.x, pos.y)
  }, [])

  const clearToast = useCallback(() => setToast(null), [])
  const clearLobbyFx = useCallback(() => setLobbyFx(null), [])

  return {
    status,
    lastEvent,
    roomState,
    question,
    rankings,
    alreadySubmitted,
    toast,
    finished,
    battleEvent,
    autoNext,
    lobbyMessages,
    lobbyFx,
    lobbyPositions,
    submitAnswer,
    sendLobbyChat,
    sendLobbyAnnounce,
    sendLobbyAction,
    sendLobbyMove,
    clearToast,
    clearLobbyFx,
    setAlreadySubmitted,
    wsRef,
  }
}
