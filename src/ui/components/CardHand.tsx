import { motion } from 'framer-motion'
import type { Card } from '@/types'
import { CardFront } from './CardFront'
import { CardBack } from './CardBack'

interface CardHandProps {
  cards: Card[]
  faceUp?: boolean
  onCardClick?: (card: Card) => void
  disabled?: boolean
  label?: string
  className?: string
}

/**
 * Renders a hand of playing cards in a fanned / overlapping layout.
 * When `faceUp` is true each card shows its rank and suit via `CardFront`;
 * when false each card shows the decorative `CardBack`.
 */
export function CardHand({
  cards,
  faceUp = true,
  onCardClick,
  disabled = false,
  label,
  className = '',
}: CardHandProps) {
  if (cards.length === 0) {
    return (
      <div className={`flex min-h-[9rem] items-center justify-center ${className}`}>
        <p className="text-sm text-gray-500 italic">No cards</p>
      </div>
    )
  }

  // Fan offset — each card shifts right, overlapping the previous one.
  const overlapOffset = cards.length > 6 ? -24 : -32

  return (
    <div className={className}>
      {label && (
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-gray-400">
          {label}
          <span className="ml-1.5 text-gray-600">({cards.length})</span>
        </p>
      )}

      <div className="relative flex" style={{ height: 160 /* 10rem */ }}>
        {cards.map((card, index) => {
          const zIndex = index

          return (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, x: -20, y: -10 }}
              animate={{
                opacity: 1,
                x: 0,
                y: 0,
                transition: { delay: index * 0.05, duration: 0.3, ease: 'easeOut' },
              }}
              className="absolute"
              style={{ left: index * Math.abs(overlapOffset), zIndex }}
            >
              {faceUp ? (
                <CardFront card={card} onClick={onCardClick} disabled={disabled} />
              ) : (
                <CardBack />
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
