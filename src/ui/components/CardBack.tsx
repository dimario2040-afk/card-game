import { motion } from 'framer-motion'

interface CardBackProps {
  onClick?: () => void
  className?: string
}

export function CardBack({ onClick, className = '' }: CardBackProps) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={onClick ? { scale: 1.05, transition: { duration: 0.2 } } : undefined}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      className={`relative h-36 w-26 cursor-default select-none rounded-xl border-2 border-white/15 bg-gradient-to-br from-card-back to-blue-900 shadow-lg ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {/* Decorative diamond pattern */}
      <div className="flex h-full items-center justify-center">
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 rotate-45 border border-white/20 bg-white/10"
            />
          ))}
        </div>
      </div>

      {/* Center emblem */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-gold/30 bg-gold/10">
          <span className="font-game text-lg text-gold/60">♠</span>
        </div>
      </div>

      {/* Corner accent */}
      <div className="absolute left-1.5 top-1.5 text-[10px] text-white/20">◆</div>
      <div className="absolute bottom-1.5 right-1.5 text-[10px] text-white/20">◆</div>
    </motion.div>
  )
}
