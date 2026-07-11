import { useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import type { Card } from '@/types'
import { AnimatedCard } from './AnimatedCard.tsx'
import { SPRING_SNAPPY } from './hooks.ts'

// ─── Types ───────────────────────────────────────────────────────────────

export interface DiscardPileProps {
  /** Cards currently in the discard pile (already flown in). */
  discarded: Card[]
  /** Card that is currently being discarded (mid-fly animation). */
  discarding: Card | null
  /** Maximum number of visible cards in the pile stack. */
  maxVisible?: number
}

// ─── Component ───────────────────────────────────────────────────────────

/**
 * Renders a discard pile on the right side of the play area.
 * Cards fly in from center to the discard position with a shrink + rotate
 * animation via the AnimatedCard `discard` variant (GPU-composited properties
 * only — no layout thrashing).
 *
 * The pile stacks up with an offset for the most recent cards.
 * Static stack cards use opacity/transform in style only (not animated).
 */
export function DiscardPile({
  discarded,
  discarding,
  maxVisible = 5,
}: DiscardPileProps) {
  const visibleDiscarded = useMemo(
    () => discarded.slice(-maxVisible),
    [discarded, maxVisible],
  )

  return (
    <div
      className="relative flex flex-col items-center justify-center"
      style={{ width: 104, minHeight: 160 }}
    >
      {/* Label */}
      <span className="mb-2 text-xs uppercase tracking-widest text-gray-500">
        Discard
      </span>

      {/* Pile stack */}
      <div className="relative flex items-center justify-center" style={{ width: 96, height: 140 }}>
        {/* Already-discarded cards (stacked offset — static, not animated) */}
        {visibleDiscarded.map((card, i) => {
          const offset = i * 1.5
          const rotation = (i - Math.floor(visibleDiscarded.length / 2)) * 1.5
          return (
            <div
              key={card.id}
              className="absolute rounded-xl border border-white/5 bg-gradient-to-br from-white/5 to-white/[0.02] shadow-inner"
              style={{
                width: 88,
                height: 128,
                top: offset,
                left: offset * 0.5,
                transform: `rotate(${rotation}deg)`,
                zIndex: i,
                opacity: 0.3 + (i / Math.max(visibleDiscarded.length, 1)) * 0.4,
              }}
            >
              <div className="flex h-full items-center justify-center opacity-40">
                <span className="font-game text-lg text-white/30">
                  {card.rank}
                </span>
              </div>
            </div>
          )
        })}

        {/* Card currently being discarded (fly-in animation via AnimatedCard) */}
        <AnimatePresence mode="popLayout">
          {discarding && (
            <AnimatedCard
              key={discarding.id}
              card={discarding}
              variant="discard"
              layoutId={`card-${discarding.id}`}
              className="absolute shadow-2xl"
              motionProps={{
                style: { zIndex: 99 },
                transition: {
                  ...SPRING_SNAPPY,
                  duration: 0.4,
                },
              }}
            />
          )}
        </AnimatePresence>

        {/* Empty state */}
        {discarded.length === 0 && !discarding && (
          <div className="flex h-full w-full items-center justify-center rounded-xl border-2 border-dashed border-white/5">
            <span className="text-xs text-gray-600">empty</span>
          </div>
        )}
      </div>

      {/* Discard count */}
      {discarded.length > 0 && (
        <span className="mt-3 text-xs text-gray-600">
          {discarded.length} card{discarded.length !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}
