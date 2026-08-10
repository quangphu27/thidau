export default function LiveScoreboard({ rankings = [], compact = true }) {
  const top = rankings.slice(0, compact ? 3 : 10)
  if (!top.length) return null

  const medals = ['🥇', '🥈', '🥉']
  const rowBg = ['bg-arena-gold/30', 'bg-slate-200/80', 'bg-orange-100']

  return (
    <div className="glass rounded-3xl border-4 border-white p-4">
      <h3 className="mb-3 text-center font-display text-sm font-bold text-arena-accent">
        🏆 BẢNG VÀNG
      </h3>
      <ul className="space-y-2">
        {top.map((p, i) => (
          <li
            key={p.player_id}
            className={`flex items-center justify-between gap-2 rounded-2xl px-3 py-2 text-sm font-bold ${
              rowBg[i] || 'bg-arena-sky/15'
            }`}
          >
            <span className="truncate text-arena-ink">
              {medals[i] || `${p.rank}.`} {p.name}
            </span>
            <span className="font-display text-arena-cyan">{p.score}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
