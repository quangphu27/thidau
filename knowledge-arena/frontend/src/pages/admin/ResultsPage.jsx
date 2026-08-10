import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { roomApi } from '../../services/api'
import WinnerScreen from '../../components/WinnerScreen'

export default function ResultsPage() {
  const [rooms, setRooms] = useState([])
  const [selected, setSelected] = useState(null)
  const [results, setResults] = useState(null)

  useEffect(() => {
    roomApi.list().then((r) => setRooms(r.data.filter((x) => x.status === 'FINISHED' || true)))
  }, [])

  const loadResults = async (code) => {
    setSelected(code)
    const { data } = await roomApi.results(code)
    setResults(data)
  }

  if (results?.winner && results.status === 'FINISHED') {
    return (
      <div>
        <button
          type="button"
          className="m-4 text-arena-ink/50"
          onClick={() => setResults(null)}
        >
          ← Quay lại
        </button>
        <WinnerScreen winner={results.winner} rankings={results.rankings} />
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-black">🏆 Kết quả</h1>
      <div className="mt-4 space-y-2">
        {rooms.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => loadResults(r.room_code)}
            className="glass flex w-full items-center justify-between rounded-2xl p-4 text-left hover:bg-arena-sky/10"
          >
            <span>
              <span className="font-display font-bold text-arena-gold">
                {r.room_code}
              </span>
              <span className="ml-2 text-sm text-arena-ink/50">
                {r.exam_title} · {r.status}
              </span>
            </span>
            <span className="text-sm">Xem →</span>
          </button>
        ))}
        {!rooms.length && <p className="text-arena-ink/50">Chưa có phòng nào.</p>}
      </div>
      {selected && results && results.status !== 'FINISHED' && (
        <div className="glass mt-6 rounded-2xl p-5">
          <h2 className="font-bold">Bảng điểm phòng {selected}</h2>
          <ul className="mt-3 space-y-2">
            {results.rankings.map((p) => (
              <li key={p.player_id} className="flex justify-between">
                <span>
                  {p.rank}. {p.name}
                </span>
                <span className="font-display text-arena-cyan">{p.score}</span>
              </li>
            ))}
          </ul>
          <Link
            to={`/admin/rooms/${selected}`}
            className="mt-4 inline-block text-arena-accent"
          >
            Mở điều khiển phòng
          </Link>
        </div>
      )}
    </div>
  )
}
