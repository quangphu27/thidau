import { useCallback, useEffect, useRef, useState } from 'react'

const ICE_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

function sdpPayload(desc) {
  if (!desc) return null
  return { type: desc.type, sdp: desc.sdp }
}

/**
 * Admin: publish mic to students/presentation.
 * Students/presentation: receive and play remote audio.
 */
export function useRoomVoice({ wsRef, role, playerId, lastEvent, status }) {
  const [micOn, setMicOn] = useState(false)
  const [micError, setMicError] = useState('')
  const [listening, setListening] = useState(false)
  const [adminSpeaking, setAdminSpeaking] = useState(false)
  const [needUnlock, setNeedUnlock] = useState(false)

  const localStreamRef = useRef(null)
  const pcsRef = useRef(new Map())
  const remoteAudioRef = useRef(null)
  const micOnRef = useRef(false)
  const pendingRemoteRef = useRef(null)

  const myPeerId =
    role === 'admin' ? 'admin' : role === 'presentation' ? 'presentation' : playerId

  const send = useCallback(
    (payload) => {
      wsRef.current?.send?.(payload)
    },
    [wsRef],
  )

  const closePeer = useCallback((peerId) => {
    const pc = pcsRef.current.get(peerId)
    if (!pc) return
    try {
      pc.onicecandidate = null
      pc.ontrack = null
      pc.onconnectionstatechange = null
      pc.close()
    } catch {
      /* ignore */
    }
    pcsRef.current.delete(peerId)
  }, [])

  const closeAllPeers = useCallback(() => {
    for (const id of [...pcsRef.current.keys()]) closePeer(id)
  }, [closePeer])

  const stopLocalTracks = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop()
        } catch {
          /* ignore */
        }
      })
      localStreamRef.current = null
    }
  }, [])

  const ensureAdminPeer = useCallback(
    async (peerId) => {
      if (!peerId || peerId === 'admin' || !localStreamRef.current || !micOnRef.current) {
        return
      }
      if (pcsRef.current.has(peerId)) return

      const pc = new RTCPeerConnection(ICE_CONFIG)
      pcsRef.current.set(peerId, pc)
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current)
      })
      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return
        send({
          type: 'webrtc_ice',
          target_peer_id: peerId,
          from_peer_id: 'admin',
          candidate: ev.candidate.toJSON(),
        })
      }
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          closePeer(peerId)
        }
      }
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: false })
        await pc.setLocalDescription(offer)
        send({
          type: 'webrtc_offer',
          target_peer_id: peerId,
          from_peer_id: 'admin',
          sdp: sdpPayload(pc.localDescription),
        })
      } catch {
        closePeer(peerId)
      }
    },
    [closePeer, send],
  )

  const startMic = useCallback(async () => {
    setMicError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError('Trình duyệt không hỗ trợ micro.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })
      // Replace any previous stream
      stopLocalTracks()
      closeAllPeers()
      localStreamRef.current = stream
      micOnRef.current = true
      setMicOn(true)
      send({ type: 'admin_mic_status', active: true })
      send({ type: 'webrtc_list_peers' })
    } catch (err) {
      micOnRef.current = false
      setMicOn(false)
      setMicError(
        err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
          ? 'Trình duyệt chặn mic. Cho phép micro (ổn định hơn với localhost hoặc HTTPS).'
          : `Không bật được micro: ${err?.message || err?.name || 'lỗi không rõ'}`,
      )
    }
  }, [send, stopLocalTracks, closeAllPeers])

  const stopMic = useCallback(() => {
    micOnRef.current = false
    setMicOn(false)
    setMicError('')
    closeAllPeers()
    stopLocalTracks()
    send({ type: 'admin_mic_status', active: false })
  }, [closeAllPeers, stopLocalTracks, send])

  const toggleMic = useCallback(() => {
    if (micOnRef.current) stopMic()
    else startMic()
  }, [startMic, stopMic])

  const playRemote = useCallback(async (stream) => {
    if (!remoteAudioRef.current) {
      remoteAudioRef.current = new Audio()
      remoteAudioRef.current.autoplay = true
    }
    const audio = remoteAudioRef.current
    audio.srcObject = stream
    try {
      await audio.play()
      setListening(true)
      setNeedUnlock(false)
      pendingRemoteRef.current = null
    } catch {
      pendingRemoteRef.current = stream
      setNeedUnlock(true)
      setListening(false)
    }
  }, [])

  const unlockAudio = useCallback(async () => {
    const stream = pendingRemoteRef.current || remoteAudioRef.current?.srcObject
    if (!stream) {
      setNeedUnlock(false)
      return
    }
    try {
      if (!remoteAudioRef.current) remoteAudioRef.current = new Audio()
      remoteAudioRef.current.srcObject = stream
      await remoteAudioRef.current.play()
      setListening(true)
      setNeedUnlock(false)
      pendingRemoteRef.current = null
    } catch {
      setNeedUnlock(true)
    }
  }, [])

  const handleOffer = useCallback(
    async (data) => {
      if (role === 'admin' || !myPeerId) return
      const from = data.from_peer_id || 'admin'
      closePeer(from)
      const pc = new RTCPeerConnection(ICE_CONFIG)
      pcsRef.current.set(from, pc)
      pc.ontrack = (ev) => {
        const stream = ev.streams?.[0] || new MediaStream([ev.track])
        playRemote(stream)
      }
      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return
        send({
          type: 'webrtc_ice',
          target_peer_id: from,
          from_peer_id: myPeerId,
          candidate: ev.candidate.toJSON(),
        })
      }
      try {
        await pc.setRemoteDescription(data.sdp)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        send({
          type: 'webrtc_answer',
          target_peer_id: from,
          from_peer_id: myPeerId,
          sdp: sdpPayload(pc.localDescription),
        })
      } catch {
        closePeer(from)
      }
    },
    [role, myPeerId, closePeer, send, playRemote],
  )

  useEffect(() => {
    if (!lastEvent || status !== 'connected') return
    const t = lastEvent.type

    if (t === 'admin_mic_status') {
      setAdminSpeaking(!!lastEvent.active)
      if (!lastEvent.active && role !== 'admin') {
        setListening(false)
        closePeer('admin')
        if (remoteAudioRef.current) {
          remoteAudioRef.current.pause()
          remoteAudioRef.current.srcObject = null
        }
      }
    }

    if (t === 'webrtc_peers' && role === 'admin' && micOnRef.current) {
      ;(lastEvent.peers || []).forEach((p) => {
        if (p?.peer_id) ensureAdminPeer(p.peer_id)
      })
    }
    if (t === 'webrtc_peer_ready' && role === 'admin' && micOnRef.current) {
      if (lastEvent.peer_id) ensureAdminPeer(lastEvent.peer_id)
    }
    if (t === 'webrtc_offer' && role !== 'admin') {
      handleOffer(lastEvent)
    }
    if (t === 'webrtc_answer' && role === 'admin') {
      const peerId = lastEvent.from_peer_id
      const pc = pcsRef.current.get(peerId)
      if (pc && lastEvent.sdp) {
        pc.setRemoteDescription(lastEvent.sdp).catch(() => {})
      }
    }
    if (t === 'webrtc_ice') {
      const peerId = lastEvent.from_peer_id
      const pc = pcsRef.current.get(peerId)
      if (pc && lastEvent.candidate) {
        pc.addIceCandidate(lastEvent.candidate).catch(() => {})
      }
    }
    if (t === 'player_left' && role === 'admin' && lastEvent.player_id) {
      closePeer(lastEvent.player_id)
    }
  }, [lastEvent, status, role, ensureAdminPeer, handleOffer, closePeer])

  useEffect(
    () => () => {
      micOnRef.current = false
      closeAllPeers()
      stopLocalTracks()
      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause()
        remoteAudioRef.current.srcObject = null
      }
    },
    [closeAllPeers, stopLocalTracks],
  )

  return {
    micOn,
    micError,
    listening,
    adminSpeaking,
    needUnlock,
    unlockAudio,
    startMic,
    stopMic,
    toggleMic,
  }
}
