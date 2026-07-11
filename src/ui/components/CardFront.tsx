import { motion } from 'framer-motion'
import type { Card } from '@/types'
import { useGameStore } from '@/store/game-store'

interface CardFrontProps {
  card: Card
  onClick?: (card: Card) => void
  disabled?: boolean
  className?: string
}

/** Maps suit string to display symbol and colour. */
const SUIT_MAP: Record<string, { symbol: string; color: string }> = {
  hearts: { symbol: '♥', color: 'text-red-400' },
  diamonds: { symbol: '♦', color: 'text-red-400' },
  clubs: { symbol: '♣', color: 'text-gray-200' },
  spades: { symbol: '♠', color: 'text-gray-200' },
}

function suitDisplay(suit: string): { symbol: string; color: string } {
  return SUIT_MAP[suit.toLowerCase()] ?? { symbol: '?', color: 'text-gray-400' }
}

export function CardFront({
  card,
  onClick,
  disabled = false,
  className = '',
}: CardFrontProps) {
  const selectedCardIds = useGameStore((s) => s.selectedCardIds)
  const selectCard = useGameStore((s) => s.selectCard)
  const deselectCard = useGameStore((s) => s.deselectCard)
  const isSelected = selectedCardIds.includes(card.id)

  const { symbol, color: suitColor } = suitDisplay(card.suit)
  const isRed = suitColor === 'text-red-400'

  const handleClick = () => {
    if (disabled) return
    if (onClick) {
        onClick(card)
        return
    }
    if (isSelected) {
      deselectCard(card.id)
    } else {
      selectCard(card.id)
    }
  }

  return (
    <motion.div
      layout
      onClick={handleClick}
      whileHover={disabled ? undefined : { y: -10, transition: { duration: 0.2, ease: 'easeOut' } }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      animate={
        isSelected
          ? {
              scale: 1.05,
              borderColor: ['rgba(255,215,0,0.6)', 'rgba(255,215,0,1)', 'rgba(255,215,0,0.6)'],
              boxShadow: [
                '0 0 12px rgba(255,215,0,0.3)',
                '0 0 24px rgba(255,215,0,0.6)',
                '0 0 12px rgba(255,215,0,0.3)',
              ],
              transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
            }
          : {
              scale: 1,
              borderColor: 'rgba(255,255,255,0.12)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              transition: { duration: 0.25 },
            }
      }
      className={`relative h-36 w-26 cursor-default select-none rounded-xl border-2 border-white/12 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-2 shadow-xl backdrop-blur-sm ${
        disabled ? 'opacity-50' : 'cursor-pointer'
      } ${className}`}
    >
      {/* Subtle inner glow */}
      <div className={`pointer-events-none absolute inset-0 rounded-[10px] bg-gradient-to-b from-transparent via-transparent to-white/[0.04]`} />

      {/* Rank + suit corner (top-left) */}
      <div className="absolute left-1.5 top-1.5 flex flex-col items-center leading-none">
        <span className={`font-game text-lg font-bold drop-shadow-sm ${suitColor}`}>{card.rank}</span>
        <span className={`-mt-0.5 text-sm leading-none drop-shadow-sm ${suitColor}`}>{symbol}</span>
      </div>

      {/* Centre suit — larger, more prominent */}
      <div className="flex h-full items-center justify-center">
        <span className={`text-4xl font-light opacity-80 drop-shadow-md ${suitColor}`}>{symbol}</span>
      </div>

      {/* Decorative dots around center */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.04]" />

      {/* Inverted corner (bottom-right) */}
      <div className="absolute bottom-1.5 right-1.5 flex rotate-180 flex-col items-center leading-none">
        <span className={`font-game text-lg font-bold drop-shadow-sm ${suitColor}`}>{card.rank}</span>
        <span className={`-mt-0.5 text-sm leading-none drop-shadow-sm ${suitColor}`}>{symbol}</span>
      </div>

      {/* Selection ring */}
      {isSelected && (
        <motion.div
          layoutId="selection-ring"
          className="absolute -inset-1 rounded-xl border-2 border-gold/60"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.15 }}
        />
      )}
    </motion.div>
  )
}
