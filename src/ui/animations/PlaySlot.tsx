import { useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Card } from '@/types'
import { AnimatedCard } from './AnimatedCard.tsx'
import { SPRING_SNAPPY } from './hooks.ts'

// ─── Types ───────────────────────────────────────────────────────────────

export interface PlaySlotCard {
  card: Card
  /** Slot index (0..N) for layout. */
  slotIndex: number
  /** Whether the card is currently being played (mid-animation). */
  playing: boolean
  /** Whether the card should be shown as resolved (post-play, before discard). */
  resolved: boolean
}

export interface PlaySlotProps {
  /** Cards being played into center slots. */
  cards: PlaySlotCard[]
  /** Total number of center slots (default 3). */
  slotCount?: number
  /** Callback when a card finishes its play animation. */
  onCardPlayed?: (cardId: string) => void
}

// ─── Component ───────────────────────────────────────────────────────────

/**
 * Renders center play slots. Each slot is a self-contained unit:
 *   - A static slot frame (background border/shadow)
 *   - An animated card that slides up from below when played
 *
 * The old architecture used a global absolute overlay for all cards,
 * which broke because the overlay lacked a positioned ancestor.
 * Now each card is absolute within its own slot frame.
 */
export function PlaySlot({
  cards,
  slotCount = 3,
  onCardPlayed,
}: PlaySlotProps) {
  // Track which cards have already fired their settlement callback
  const settledRef = useRef<Set<string>>(new Set())

  // Reset settled set when cards list changes significantly
  useEffect(() => {
    const ids = new Set(cards.map((c) => c.card.id))
    settledRef.current = new Set(
      [...settledRef.current].filter((id) => ids.has(id)),
    )
  }, [cards])

  // Map cards by slot index for O(1) lookup
  const cardsBySlot = useMemo(() => {
    const map = new Map<number, PlaySlotCard>()
    for (const c of cards) map.set(c.slotIndex, c)
    return map
  }, [cards])

  return (
    <div className="relative flex items-center justify-center gap-2">
      {Array.from({ length: slotCount }).map((_, i) => {
        const entry = cardsBySlot.get(i)
        const hasCard = !!entry

        // Animation state
        const currentAnim = entry
          ? entry.playing
            ? 'playing'
            : entry.resolved
              ? 'resolved'
              : 'hidden'
          : 'hidden'

        // Arc offsets per slot for visual variety
        const arcX = (i - (slotCount - 1) / 2) * 12
        const arcRotate = i % 2 === 0 ? -6 : 6

        return (
          <div
            key={`slot-${i}`}
            className="relative flex-shrink-0"
            style={{ width: 112, height: 152 }}
          >
            {/* ── Slot frame background ── */}
            <div
              className={`absolute inset-0 flex items-center justify-center rounded-xl border-2 backdrop-blur-sm transition-all duration-500 ${
                hasCard
                  ? 'border-gold/40 bg-gold/[0.06] shadow-lg shadow-gold/10'
                  : 'border-dashed border-white/8 bg-white/[0.02]'
              }`}
            >
              <span
                className={`select-none text-xs transition-opacity duration-300 ${
                  hasCard ? 'opacity-0' : 'opacity-20'
                }`}
                style={{ color: 'rgba(255,255,255,0.15)' }}
              >
                {i + 1}
              </span>
            </div>

            {/* ── Animated card (absolute within this slot) ── */}
            <AnimatePresence>
              {entry && currentAnim !== 'hidden' && (
                <motion.div
                  key={entry.card.id}
                  initial={{ opacity: 0, scale: 0.7, y: 80, x: 0, rotate: arcRotate }}
                  animate={
                    entry.resolved
                      ? {
                          opacity: 1,
                          scale: 1,
                          y: 0,
                          x: 0,
                          rotate: 0,
                          transition: { ...SPRING_SNAPPY, duration: 0.4 },
                        }
                      : {
                          opacity: 1,
                          scale: 1.05,
                          y: 0,
                          x: arcX,
                          rotate: 0,
                          transition: { ...SPRING_SNAPPY, duration: 0.55 },
                        }
                  }
                  exit={{
                    opacity: 0,
                    scale: 0.5,
                    y: 60,
                    rotate: 10,
                    transition: { duration: 0.3, ease: 'easeIn' as const },
                  }}
                  onAnimationComplete={(definition: unknown) => {
                    // definition is the variant key string
                    if (
                      typeof definition === 'string' &&
                      entry.playing &&
                      !settledRef.current.has(entry.card.id)
                    ) {
                      settledRef.current.add(entry.card.id)
                      onCardPlayed?.(entry.card.id)
                    }
                  }}
                  className="absolute inset-0 z-10 flex items-center justify-center"
                >
                  <AnimatedCard
                    card={entry.card}
                    variant={entry.resolved ? 'selected' : 'idle'}
                    className="h-36 w-28 shadow-2xl"
                  >
                    <div
                      className={`flex h-full flex-col items-center justify-center rounded-xl ${
                        entry.resolved
                          ? 'bg-gradient-to-b from-gold/10 to-gold/5'
                          : ''
                      }`}
                    >
                      <span className="font-game text-3xl font-bold text-gold drop-shadow-lg">
                        {entry.card.rank}
                      </span>
                      <span className="text-sm font-semibold tracking-wider text-gold/60">
                        {entry.card.suit}
                      </span>
                      {entry.resolved && (
                        <span className="mt-1 rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-300">
                          Played
                        </span>
                      )}
                    </div>
                  </AnimatedCard>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
