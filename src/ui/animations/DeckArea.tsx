import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Card } from '@/types'
import { AnimatedCard, type CardAnimVariant } from './AnimatedCard.tsx'
import {
  SPRING_BOUNCE,
  SPRING_GENTLE,
} from './hooks.ts'

// ─── Types ───────────────────────────────────────────────────────────────

export interface DealAnimationState {
  /** Cards currently being dealt (animating in). */
  dealing: Card[]
  /** Cards already in hand (idle). */
  inHand: Card[]
  /** Whether the deal animation is still running. */
  isDealing: boolean
}

export interface DeckAreaProps {
  /** The deck state describing cards dealing and in-hand. */
  state: DealAnimationState
  /** Cards in the remaining deck pile. */
  deckCount: number
  /** Called when a card in hand is clicked. */
  onCardClick?: (card: Card) => void
  /** IDs of currently selected cards. */
  selectedCardIds: string[]
  /** Frames per card stagger during deal. */
  staggerMs?: number
  /** Offset before deal starts. */
  initialDelay?: number
}

// ─── DeckPile component ──────────────────────────────────────────────────

function DeckPile({
  count,
  position,
}: {
  count: number
  position: 'left' | 'right'
}) {
  const visibleCount = Math.min(count, 5)
  const side = position === 'left' ? 0 : -count * 0.5
  const pileOffset = position === 'left' ? -2 : 2

  return (
    <div className="relative flex items-center justify-center" style={{ width: 104, height: 144 }}>
      {/* Stacked deck cards — each slightly offset */}
      {Array.from({ length: visibleCount }).map((_, i) => (
        <motion.div
          key={`deck-${i}`}
          className="absolute rounded-xl border border-white/10 bg-gradient-to-br from-card-back to-blue-900 shadow-lg"
          style={{
            width: 88,
            height: 128,
            left: side + i * pileOffset,
            top: i * 1.5,
            zIndex: -i,
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.03, duration: 0.3 }}
        >
          <div className="flex h-full items-center justify-center">
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 9 }).map((_, j) => (
                <div
                  key={j}
                  className="h-1.5 w-1.5 rotate-45 border border-white/20 bg-white/10"
                />
              ))}
            </div>
          </div>
        </motion.div>
      ))}
      {/* Count label */}
      {count > 0 && (
        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-gray-500">
          {count} cards
        </span>
      )}
    </div>
  )
}

// ─── Pre-compute deal entries (avoids calling hooks inside .map()) ───────

interface DealEntry {
  card: Card
  delay: number
  variant: CardAnimVariant
  left: number
  zIndex: number
}

function useDealEntries(
  dealing: Card[],
  staggerMs: number,
  initialDelay: number,
  selectedCardIds: string[],
  overlapOffset: number,
): DealEntry[] {
  return useMemo(
    () =>
      dealing.map((card, i) => {
        // Staggered delay pre-computed as a plain number — NOT a hook call
        const delay = initialDelay + i * (staggerMs / 1000)
        return {
          card,
          delay,
          variant: selectedCardIds.includes(card.id) ? 'selected' : 'deal',
          left: i * overlapOffset,
          zIndex: i + 10,
        }
      }),
    [dealing, staggerMs, initialDelay, selectedCardIds, overlapOffset],
  )
}

interface HandEntry {
  card: Card
  variant: CardAnimVariant
  left: number
  zIndex: number
}

function useHandEntries(
  inHand: Card[],
  selectedCardIds: string[],
  overlapOffset: number,
): HandEntry[] {
  return useMemo(
    () =>
      inHand.map((card, i) => ({
        card,
        variant: selectedCardIds.includes(card.id) ? 'selected' : 'idle',
        left: i * overlapOffset,
        zIndex: i,
      })),
    [inHand, selectedCardIds, overlapOffset],
  )
}

// ─── Component ───────────────────────────────────────────────────────────

/**
 * Renders the deck pile on the left and the player's hand on the right.
 * Cards being dealt fly from the deck position to their hand position
 * with staggered timing.
 *
 * Hooks are called only at the top level — delays are pre-computed
 * with useMemo rather than computed inline in the JSX map to avoid
 * violating the Rules of Hooks.
 */
export function DeckArea({
  state,
  deckCount,
  onCardClick,
  selectedCardIds,
  staggerMs = 60,
  initialDelay = 0,
}: DeckAreaProps) {
  const totalCards = state.inHand.length + state.dealing.length
  // Fan offset — wider spread for more cards
  const overlapOffset = totalCards > 6 ? 24 : 32

  // Pre-compute entries with delays as plain numbers (not hook calls)
  const dealEntries = useDealEntries(
    state.dealing,
    staggerMs,
    initialDelay,
    selectedCardIds,
    overlapOffset,
  )
  const handEntries = useHandEntries(
    state.inHand,
    selectedCardIds,
    overlapOffset,
  )

  return (
    <div className="flex items-end gap-6">
      {/* ── Deck pile ── */}
      <DeckPile count={deckCount} position="left" />

      {/* ── Hand area ── */}
      <div className="relative flex" style={{ height: 160, minWidth: 104 }}>
        <AnimatePresence mode="popLayout">
          {/* Dealing cards (fly in) */}
          {dealEntries.map(({ card, delay, variant, left, zIndex }) => (
            <AnimatedCard
              key={card.id}
              card={card}
              variant={variant}
              delay={delay}
              layoutId={`card-${card.id}`}
              onClick={() => onCardClick?.(card)}
              className="absolute"
              motionProps={{
                style: { left, zIndex },
                transition: {
                  ...SPRING_BOUNCE,
                  delay,
                },
              }}
            />
          ))}

          {/* Already-in-hand cards (idle) */}
          {handEntries.map(({ card, variant, left, zIndex }) => (
            <AnimatedCard
              key={card.id}
              card={card}
              variant={variant}
              delay={0}
              layoutId={`card-${card.id}`}
              onClick={() => onCardClick?.(card)}
              className="absolute"
              motionProps={{
                style: { left, zIndex },
                transition: SPRING_GENTLE,
              }}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
