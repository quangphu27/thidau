export const BLOCK_CATALOG = [
  { kind: 'event_flag', label: 'khi bấm cờ', color: '#ffbf00', shape: 'hat', params: [], group: 'Sự kiện' },
  { kind: 'event_clicked', label: 'khi nhân vật này được bấm', color: '#ffbf00', shape: 'hat', params: [], group: 'Sự kiện' },
  { kind: 'motion_move', label: 'di chuyển {0} bước', color: '#4c97ff', shape: 'stack', params: [{ key: 'n', placeholder: 'số' }], group: 'Chuyển động' },
  { kind: 'motion_turn_right', label: 'xoay phải {0} độ', color: '#4c97ff', shape: 'stack', params: [{ key: 'n', placeholder: 'độ' }], group: 'Chuyển động' },
  { kind: 'motion_turn_left', label: 'xoay trái {0} độ', color: '#4c97ff', shape: 'stack', params: [{ key: 'n', placeholder: 'độ' }], group: 'Chuyển động' },
  { kind: 'motion_change_x', label: 'thay đổi x một lượng {0}', color: '#4c97ff', shape: 'stack', params: [{ key: 'n', placeholder: 'x' }], group: 'Chuyển động' },
  { kind: 'motion_change_y', label: 'thay đổi y một lượng {0}', color: '#4c97ff', shape: 'stack', params: [{ key: 'n', placeholder: 'y' }], group: 'Chuyển động' },
  { kind: 'motion_goto', label: 'đi tới x: {0} y: {1}', color: '#4c97ff', shape: 'stack', params: [{ key: 'x', placeholder: 'x' }, { key: 'y', placeholder: 'y' }], group: 'Chuyển động' },
  { kind: 'control_repeat', label: 'lặp lại {0} lần', color: '#ffab19', shape: 'cblock', params: [{ key: 'n', placeholder: 'lần' }], group: 'Điều khiển' },
  { kind: 'control_forever', label: 'lặp mãi mãi', color: '#ffab19', shape: 'cblock', params: [], group: 'Điều khiển' },
  { kind: 'control_wait', label: 'đợi {0} giây', color: '#ffab19', shape: 'stack', params: [{ key: 'n', placeholder: 'giây' }], group: 'Điều khiển' },
  { kind: 'pen_down', label: 'đặt bút', color: '#0fbd8c', shape: 'stack', params: [], group: 'Bút' },
  { kind: 'pen_up', label: 'nhấc bút', color: '#0fbd8c', shape: 'stack', params: [], group: 'Bút' },
  { kind: 'pen_clear', label: 'xóa tất cả', color: '#0fbd8c', shape: 'stack', params: [], group: 'Bút' },
  { kind: 'looks_say', label: 'nói {0}', color: '#9966ff', shape: 'stack', params: [{ key: 'text', placeholder: 'chữ' }], group: 'Ngoại hình' },
]

export const catalogByKind = Object.fromEntries(BLOCK_CATALOG.map((b) => [b.kind, b]))

export function newBlock(kind) {
  const meta = catalogByKind[kind]
  if (!meta) return null
  return {
    id: `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    params: (meta.params || []).map((p) => ({
      key: p.key,
      value: '',
      blank: true,
    })),
    children: meta.shape === 'cblock' ? [] : undefined,
  }
}

export function toSubmitScript(nodes) {
  return (nodes || []).map((n) => ({
    kind: n.kind,
    params: (n.blanks || []).map((b) => ({
      key: b.key,
      value: n.values?.[b.index] ?? n.values?.[b.key] ?? '',
      blank: true,
    })),
    children: n.shape === 'cblock' ? toSubmitScript(n.children || []) : [],
  }))
}
