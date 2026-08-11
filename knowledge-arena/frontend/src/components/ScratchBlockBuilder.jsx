import { BLOCK_CATALOG, catalogByKind, newBlock } from '../scratch/blocks'

function renderLabel(label, params, onParam) {
  const parts = String(label).split(/\{(\d+)\}/)
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      const idx = Number(part)
      const p = params[idx] || { value: '', blank: true }
      return (
        <span key={i} className="inline-flex items-center gap-1">
          <input
            className="w-14 rounded-md bg-white px-1 py-0.5 text-center text-sm font-black text-arena-ink"
            value={p.value}
            onChange={(e) => onParam(idx, { ...p, value: e.target.value })}
            placeholder="#"
          />
          <label className="text-[10px] font-bold text-white/90">
            <input
              type="checkbox"
              className="mr-0.5"
              checked={!!p.blank}
              onChange={(e) => onParam(idx, { ...p, blank: e.target.checked })}
            />
            HS điền
          </label>
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function AdminBlock({ node, onChange, onRemove, onAddInside, depth = 0 }) {
  const meta = catalogByKind[node.kind] || { label: node.kind, color: '#888', shape: 'stack' }
  const isC = meta.shape === 'cblock'

  return (
    <div className="scratch-admin-block" style={{ marginLeft: depth * 14 }}>
      <div
        className={`scratch-block scratch-block-${meta.shape}`}
        style={{ background: meta.color }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-white">
            {renderLabel(meta.label, node.params || [], (idx, next) => {
              const params = [...(node.params || [])]
              params[idx] = next
              onChange({ ...node, params })
            })}
          </span>
          <div className="ml-auto flex gap-1">
            {isC && (
              <button
                type="button"
                className="rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-black text-white"
                onClick={onAddInside}
              >
                + trong
              </button>
            )}
            <button
              type="button"
              className="rounded bg-black/25 px-1.5 py-0.5 text-[10px] font-black text-white"
              onClick={onRemove}
            >
              x
            </button>
          </div>
        </div>
      </div>
      {isC && (
        <div className="scratch-c-body ml-3 border-l-8 pl-2" style={{ borderColor: meta.color }}>
          {(node.children || []).map((ch, i) => (
            <AdminBlock
              key={ch.id}
              node={ch}
              depth={depth + 1}
              onChange={(n) => {
                const children = [...(node.children || [])]
                children[i] = n
                onChange({ ...node, children })
              }}
              onRemove={() =>
                onChange({
                  ...node,
                  children: (node.children || []).filter((_, j) => j !== i),
                })
              }
              onAddInside={() => {
                /* nested add handled via parent palette target */
              }}
            />
          ))}
          {!(node.children || []).length && (
            <p className="py-1 text-[10px] font-bold text-white/70">Thêm khối vào trong…</p>
          )}
        </div>
      )}
    </div>
  )
}

function insertInto(script, parentId, block) {
  if (!parentId) return [...script, block]
  const walk = (nodes) =>
    nodes.map((n) => {
      if (n.id === parentId) {
        return { ...n, children: [...(n.children || []), block] }
      }
      if (n.children?.length) {
        return { ...n, children: walk(n.children) }
      }
      return n
    })
  return walk(script)
}

function removeNode(script, id) {
  const out = []
  for (const n of script) {
    if (n.id === id) continue
    out.push({
      ...n,
      children: n.children ? removeNode(n.children, id) : n.children,
    })
  }
  return out
}

export default function ScratchBlockBuilder({ script = [], onChange }) {
  const groups = [...new Set(BLOCK_CATALOG.map((b) => b.group))]
  const cblocks = []
  const collect = (nodes) => {
    for (const n of nodes || []) {
      if ((catalogByKind[n.kind] || {}).shape === 'cblock') cblocks.push(n)
      if (n.children) collect(n.children)
    }
  }
  collect(script)

  const add = (kind, parentId) => {
    const b = newBlock(kind)
    if (!b) return
    onChange(insertInto(script, parentId || null, b))
  }

  return (
    <div className="space-y-3 rounded-2xl bg-[#1e1e2e] p-3">
      <p className="text-sm font-black text-white">Tạo chương trình Scratch mẫu</p>
      <p className="text-xs text-white/70">
        Tick <strong>HS điền</strong> ở ô số để học sinh phải nhập (vd: 360 lần). Khối sẽ bị tách lẻ và xáo trộn khi thi.
      </p>
      {groups.map((g) => (
        <div key={g}>
          <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-white/50">{g}</p>
          <div className="flex flex-wrap gap-1">
            {BLOCK_CATALOG.filter((b) => b.group === g).map((b) => (
              <button
                key={b.kind}
                type="button"
                onClick={() => add(b.kind, null)}
                className="rounded-lg px-2 py-1 text-xs font-bold text-white"
                style={{ background: b.color }}
              >
                {b.label.replace(/\{(\d+)\}/g, '□')}
              </button>
            ))}
          </div>
        </div>
      ))}

      {cblocks.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-black text-amber-200">Thêm khối VÀO TRONG vòng lặp</p>
          <div className="flex flex-wrap gap-1">
            {cblocks.map((c) => (
              <div key={c.id} className="flex flex-wrap gap-1 rounded-lg bg-white/10 p-1">
                <span className="px-1 text-[10px] font-bold text-amber-100">
                  {(catalogByKind[c.kind] || {}).label}
                </span>
                {BLOCK_CATALOG.filter((b) => b.shape !== 'hat').slice(0, 8).map((b) => (
                  <button
                    key={b.kind}
                    type="button"
                    onClick={() => add(b.kind, c.id)}
                    className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                    style={{ background: b.color }}
                  >
                    + {b.label.replace(/\{(\d+)\}/g, '□')}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="min-h-[80px] rounded-xl bg-[#111] p-2">
        <p className="mb-2 text-[10px] font-black uppercase text-white/40">Chương trình đúng</p>
        {script.map((node, i) => (
          <AdminBlock
            key={node.id}
            node={node}
            onChange={(n) => {
              const next = [...script]
              next[i] = n
              onChange(next)
            }}
            onRemove={() => onChange(removeNode(script, node.id))}
            onAddInside={() => {}}
          />
        ))}
        {!script.length && (
          <p className="py-4 text-center text-xs font-bold text-white/40">
            Bấm khối ở trên để xếp chương trình mẫu
          </p>
        )}
      </div>
    </div>
  )
}
