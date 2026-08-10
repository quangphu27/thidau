import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function HomePage() {
  return (
    <div className="arena-bg relative flex min-h-screen flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative z-10 w-full max-w-xl text-center"
      >
        <p className="bob text-6xl md:text-7xl">🎮</p>
        <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-arena-ink md:text-6xl">
          ĐẤU TRƯỜNG
          <br />
          <span className="text-arena-accent">KIẾN THỨC</span>
        </h1>
        <p className="mt-4 text-lg font-semibold text-arena-ink/70 md:text-xl">
          Cùng bạn bè thi đấu vui vẻ — ai nhanh và đúng sẽ thắng!
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/join"
            className="rounded-full bg-arena-accent px-8 py-4 text-lg font-black text-white shadow-[0_8px_0_#c43a1a] transition hover:brightness-110 active:translate-y-1 active:shadow-[0_4px_0_#c43a1a]"
          >
            🚀 THAM GIA PHÒNG
          </Link>
          <Link
            to="/admin/login"
            className="rounded-full border-4 border-arena-cyan bg-white px-8 py-4 text-lg font-bold text-arena-cyan shadow-md hover:bg-arena-sky/20"
          >
            Admin
          </Link>
        </div>
        <div className="mt-12 flex justify-center gap-4 text-3xl">
          <span className="wiggle">⭐</span>
          <span className="bob">🌈</span>
          <span className="wiggle" style={{ animationDelay: '0.4s' }}>
            🏆
          </span>
        </div>
      </motion.div>
    </div>
  )
}
