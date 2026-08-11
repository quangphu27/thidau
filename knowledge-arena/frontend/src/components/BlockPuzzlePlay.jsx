import { useEffect, useMemo, useState } from 'react'
import { catalogByKind } from '../scratch/blocks'

function shuffle(list, seed) {
  const arr = [...list]
  let h = 0
  const s = String(seed || 'x')
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  for (let i = arr.length - 1; i > 0; i--) {
    h = (h * 1664525 + 1013904223) >>> 0
    const j = h % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function pieceFromServer(p) {
  const meta = catalogByKind[p.kind] || p
  return {
    uid: p.uid,
    kind: p.kind,
    label: p.label || meta.label || p.kind,
    color: p.color || meta.color || '#888',
    shape: p.shape || meta.shape || 'stack',
    blanks: p.blanks || [],
    values: {},
    children: [],
  }
}

function labelWithInputs(node, disabled, onValue) {
  const parts = String(node.label || '').split(/\{(\d+)\}/)
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      const idx = Number(part)
      const blank = (node.blanks || []).find((b) => Number(b.index) === idx)
      if (!blank) return <span key={i} className="mx-1 rounded bg-white/80 px-1 text-arena-ink">□</span>
      return (
        <input
          key={i}
          disabled={disabled}
          inputMode="numeric"
          className="mx-1 w-14 rounded-md bg-white px-1 py-0.5 text-center text-sm font-black text-arena-ink disabled:opacity-60"
          placeholder={blank.placeholder || '#'}
          value={node.values?.[idx] ?? ''}
          onChange={(e) => onValue(idx, e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
      )
    }
    return <span key={i}>{part}</span>
  })
}

function toSubmit(nodes) {
  return (nodes || []).map((n) => {
    const meta = catalogByKind[n.kind]
    const count = Math.max((meta?.params || []).length, (n.blanks || []).length)
    const params = []
    for (let i = 0; i < count; i++) {
      const blank = (n.blanks || []).find((b) => Number(b.index) === i)
      params.push({
        key: blank?.key || meta?.params?.[i]?.key || `p${i}`,
        value: n.values?.[i] ?? '',
        blank: !!blank,
      })
    }
    return {
      kind: n.kind,
      params,
      children: n.shape === 'cblock' ? toSubmit(n.children || []) : [],
    }
  })
}

function ScriptNode({
  node,
  disabled,
  selectedUid,
  onSelect,
  onValue,
  onRemove,
  onDropInside,
}) {
  const isC = node.shape === 'cblock'
  return (
    <div className="scratch-script-node">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect(node.uid)}
        className={`scratch-block scratch-block-${node.shape} w-full text-left ${
          selectedUid === node.uid ? 'ring-4 ring-white' : ''
        }`}
        style={{ background: node.color }}
        onDragOver={(e) => {
          if (isC) e.preventDefault()
        }}
        onDrop={(e) => {
          if (!isC) return
          e.preventDefault()
          e.stopPropagation()
          const uid = e.dataTransfer.getData('uid')
          if (uid) onDropInside(node.uid, uid)
        }}
      >
        <div className="flex items-center gap-2 font-bold text-white">
          <span className="flex-1">
            {labelWithInputs(node, disabled, (idx, v) => onValue(node.uid, idx, v))}
          </span>
          {!disabled && (
            <span
              role="button"
              tabIndex={-1}
              className="rounded bg-black/25 px-1.5 text-[10px] font-black"
              onClick={(e) => {
                e.stopPropagation()
                onRemove(node.uid)
              }}
            >
              trả
            </span>
          )}
        </div>
      </button>
      {isC && (
        <div
          className="scratch-c-body ml-3 min-h-[28px] border-l-8 py-1 pl-2"
          style={{ borderColor: node.color }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const uid = e.dataTransfer.getData('uid')
            if (uid) onDropInside(node.uid, uid)
          }}
        >
          {(node.children || []).map((ch) => (
            <ScriptNode
              key={ch.uid}
              node={ch}
              disabled={disabled}
              selectedUid={selectedUid}
              onSelect={onSelect}
              onValue={onValue}
              onRemove={onRemove}
              onDropInside={onDropInside}
            />
          ))}
          {!(node.children || []).length && (
            <p className="text-[10px] font-bold text-white/50">Thả / chọn rồi bấm «Vào trong»</p>
          )}
        </div>
      )}
    </div>
  )
}

function findAndTake(nodes, uid) {
  let found = null
  const rest = []
  for (const n of nodes || []) {
    if (n.uid === uid) {
      found = n
      continue
    }
    const child = findAndTake(n.children || [], uid)
    if (child.node) {
      found = child.node
      rest.push({ ...n, children: child.rest })
    } else {
      rest.push(n)
    }
  }
  return { node: found, rest }
}

function insertInside(nodes, parentUid, node) {
  return (nodes || []).map((n) => {
    if (n.uid === parentUid && n.shape === 'cblock') {
      return { ...n, children: [...(n.children || []), node] }
    }
    if (n.children?.length) {
      return { ...n, children: insertInside(n.children, parentUid, node) }
    }
    return n
  })
}

export default function BlockPuzzlePlay({
  pieces = [],
  disabled = false,
  seed = 's',
  onSubmit,
  points = 20,
  retryLeft = 0,
}) {
  const [bank, setBank] = useState([])
  const [script, setScript] = useState([])
  const [picked, setPicked] = useState(null)
  const [target, setTarget] = useState(null) // cblock uid or null = root

  const pieceKey = useMemo(() => (pieces || []).map((p) => p.uid).join('|'), [pieces])

  useEffect(() => {
    setBank(shuffle((pieces || []).map(pieceFromServer), seed))
    setScript([])
    setPicked(null)
    setTarget(null)
  }, [pieceKey, seed])

  const place = (uid, insideUid = null) => {
    if (disabled) return
    let node = bank.find((p) => p.uid === uid)
    let nextBank = bank.filter((p) => p.uid !== uid)
    let nextScript = script
    if (!node) {
      const taken = findAndTake(script, uid)
      node = taken.node
      nextScript = taken.rest
    }
    if (!node) return
    if (insideUid) nextScript = insertInside(nextScript, insideUid, node)
    else nextScript = [...nextScript, node]
    setBank(nextBank)
    setScript(nextScript)
    setPicked(null)
  }

  const returnToBank = (uid) => {
    if (disabled) return
    const taken = findAndTake(script, uid)
    if (!taken.node) return
    // also return nested children to bank
    const dump = []
    const flatten = (n) => {
      dump.push({ ...n, children: n.shape === 'cblock' ? [] : n.children })
      ;(n.children || []).forEach(flatten)
    }
    flatten(taken.node)
    setScript(taken.rest)
    setBank((b) => [...b, ...dump])
  }

  const setValue = (uid, idx, value) => {
    const walk = (nodes) =>
      nodes.map((n) => {
        if (n.uid === uid) return { ...n, values: { ...n.values, [idx]: value } }
        if (n.children?.length) return { ...n, children: walk(n.children) }
        return n
      })
    setScript((s) => walk(s))
  }

  const submit = (e) => {
    e.preventDefault()
    if (disabled || bank.length) return
    onSubmit?.(JSON.stringify({ script: toSubmit(script) }))
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-center text-sm font-extrabold text-arena-cyan">
        Ghép khối Scratch · Đúng được {points} điểm
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[1.5rem] border-4 border-white bg-[#2e2e4a] p-3">
          <p className="mb-2 text-xs font-black uppercase text-white/70">Khối lộn xộn</p>
          <div className="flex min-h-[120px] flex-col gap-2">
            {bank.map((p) => (
              <button
                key={p.uid}
                type="button"
                draggable={!disabled}
                disabled={disabled}
                onDragStart={(e) => e.dataTransfer.setData('uid', p.uid)}
                onClick={() => setPicked(p.uid)}
                className={`scratch-block scratch-block-${p.shape} text-left font-bold text-white ${
                  picked === p.uid ? 'ring-4 ring-white' : ''
                }`}
                style={{ background: p.color }}
              >
                {p.label.replace(/\{(\d+)\}/g, '□')}
              </button>
            ))}
            {!bank.length && (
              <p className="py-6 text-center text-xs font-bold text-white/40">Đã dùng hết khối</p>
            )}
          </div>
        </div>

        <div
          className="rounded-[1.5rem] border-4 border-dashed border-arena-gold bg-[#111827] p-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const uid = e.dataTransfer.getData('uid')
            if (uid) place(uid, null)
          }}
        >
          <p className="mb-2 text-xs font-black uppercase text-arena-gold">Chương trình của bạn</p>
          <div className="min-h-[120px] space-y-1">
            {script.map((node) => (
              <ScriptNode
                key={node.uid}
                node={node}
                disabled={disabled}
                selectedUid={target}
                onSelect={(id) => setTarget(id === target ? null : id)}
                onValue={(uid, idx, v) => setValue(uid, idx, v)}
                onRemove={returnToBank}
                onDropInside={(parent, uid) => place(uid, parent)}
              />
            ))}
            {!script.length && (
              <p className="py-8 text-center text-sm font-bold text-white/35">
                Kéo khối vào đây, hoặc chọn khối rồi bấm Thêm
              </p>
            )}
          </div>
        </div>
      </div>

      {!disabled && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!picked}
            onClick={() => place(picked, null)}
            className="rounded-xl bg-arena-cyan px-3 py-2 text-sm font-black text-white disabled:opacity-40"
          >
            Thêm xuống chương trình
          </button>
          <button
            type="button"
            disabled={!picked || !target}
            onClick={() => place(picked, target)}
            className="rounded-xl bg-amber-500 px-3 py-2 text-sm font-black text-white disabled:opacity-40"
          >
            Vào trong vòng lặp đã chọn
          </button>
        </div>
      )}

      <button
        type="submit"
        disabled={disabled || bank.length > 0}
        className="w-full rounded-full bg-arena-accent py-3 font-black text-white shadow-[0_6px_0_#c43a1a] disabled:opacity-50"
      >
        {retryLeft > 0 ? `Đợi ${retryLeft}s...` : 'Gửi chương trình'}
      </button>
      {bank.length > 0 && (
        <p className="text-center text-xs font-bold text-arena-ink/50">
          Hãy dùng hết các khối rồi gửi
        </p>
      )}
    </form>
  )
}
