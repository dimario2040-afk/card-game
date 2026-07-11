import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { Card } from '@/types'
import { useGameStore } from '@/store/game-store'
import { DeckArea, type DealAnimationState } from './DeckArea.tsx'
import { PlaySlot, type PlaySlotCard } from './PlaySlot.tsx'
import { DiscardPile } from './DiscardPile.tsx'
import {
  DamageNumbers,
  type DamageEvent,
} from './DamageNumber.tsx'
import { PhaseBanner, type BannerPosition, type BannerStyle } from './PhaseBanner.tsx'
import { useAnimationSequence } from './hooks.ts'
import { findBestHand, HAND_TYPE_NAMES, HandType } from '@/game/hand-evaluator'
import { calculateDamage } from '@/game/combat-engine'

// ─── Types ───────────────────────────────────────────────────────────────

interface BannerState {
  text: string
  position: BannerPosition
  style: BannerStyle
  subtitle?: string
}

interface PlayingCardState {
  card: Card
  /** 'hand' | 'playing' | 'resolved' | 'discarding' | 'discarded' */
  stage: 'hand' | 'playing' | 'resolved' | 'discarding' | 'discarded'
  slotIndex: number
}

interface HandResultState {
  handName: string
  handType: HandType
  chips: number
  mult: number
  damage: number
  cards: readonly Card[]
  visible: boolean
}

// ─── Board Constants ─────────────────────────────────────────────────────

const INITIAL_DEAL_COUNT = 5

// ─── Hand type → display helpers ─────────────────────────────────────────

const HAND_TIER_COLORS: Record<number, string> = {
  [HandType.HIGH_CARD]: 'text-gray-400',
  [HandType.ONE_PAIR]: 'text-blue-300',
  [HandType.TWO_PAIR]: 'text-blue-400',
  [HandType.THREE_OF_A_KIND]: 'text-cyan-300',
  [HandType.STRAIGHT]: 'text-teal-300',
  [HandType.FLUSH]: 'text-green-300',
  [HandType.FULL_HOUSE]: 'text-yellow-300',
  [HandType.FOUR_OF_A_KIND]: 'text-orange-300',
  [HandType.STRAIGHT_FLUSH]: 'text-red-300',
  [HandType.ROYAL_FLUSH]: 'text-gold',
}

function handTypeName(type: HandType): string {
  const name = HAND_TYPE_NAMES[type] ?? 'UNKNOWN'
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ─── Component ───────────────────────────────────────────────────────────

/**
 * Animated game board orchestrator.
 *
 * Manages the full animation lifecycle:
 *   1. Deal: cards fly from deck to hand (staggered)
 *   2. Play: selected cards arc to center slots
 *   3. Damage: floating numbers + screen shake
 *   4. Discard: played cards fly to discard pile
 *   5. Phase banners: slide in/out for turn changes
 *
 * All side-effectful logic (setState calls, timeouts) lives in useEffect
 * hooks — NOT in the render body. Previous-value tracking uses refs to
 * avoid rendering twice.
 *
 * Uses layoutId for shared layout animations between all card states.
 */
export function GameBoard() {
  const gamePhase = useGameStore((s) => s.gamePhase)
  const turn = useGameStore((s) => s.turn)
  const player = useGameStore((s) => s.player)
  const enemy = useGameStore((s) => s.enemy)
  const selectCard = useGameStore((s) => s.selectCard)
  const deselectCard = useGameStore((s) => s.deselectCard)
  const selectedCardIds = useGameStore((s) => s.selectedCardIds)
  const applyDamage = useGameStore((s) => s.applyDamage)
  const endTurn = useGameStore((s) => s.endTurn)

  // ── Animation orchestrator ────────────────────────────────────────
  const animSeq = useAnimationSequence()

  // ── Previous-value refs (avoids setState-in-render anti-pattern) ──
  const prevHealthRef = useRef(enemy.health)
  const prevTurnRef = useRef(turn)
  const hasDealtRef = useRef(false)

  // ── Deal state ─────────────────────────────────────────────────────
  const [dealState, setDealState] = useState<DealAnimationState>({
    dealing: [],
    inHand: [],
    isDealing: false,
  })

  // Deal cards when the game transitions to 'playing'
  useEffect(() => {
    if (gamePhase !== 'playing') return
    if (hasDealtRef.current) return
    if (player.hand.length === 0) return

    const cardsToDeal = player.hand.slice(0, INITIAL_DEAL_COUNT)
    setDealState({
      dealing: cardsToDeal,
      inHand: [],
      isDealing: true,
    })
    hasDealtRef.current = true
    animSeq.start('dealing')

    const timer = setTimeout(() => {
      setDealState({
        dealing: [],
        inHand: cardsToDeal,
        isDealing: false,
      })
    }, cardsToDeal.length * 60 + 500)

    return () => clearTimeout(timer)
  }, [gamePhase, player.hand, animSeq])

  // Reset deal state when returning to lobby
  useEffect(() => {
    if (gamePhase !== 'lobby') return
    hasDealtRef.current = false
    setDealState({ dealing: [], inHand: [], isDealing: false })
  }, [gamePhase])

  // Clean up stale selectedCardIds when cards leave the hand
  useEffect(() => {
    const handIds = new Set(player.hand.map((c) => c.id))
    const staleIds = selectedCardIds.filter((id) => !handIds.has(id))
    staleIds.forEach((id) => deselectCard(id))
  }, [player.hand, selectedCardIds, deselectCard])

  // ── Play state ────────────────────────────────────────────────────
  const [playingCards, setPlayingCards] = useState<PlayingCardState[]>([])

  // ── Hand result state ────────────────────────────────────────────
  const [handResult, setHandResult] = useState<HandResultState>({
    handName: '',
    handType: HandType.HIGH_CARD,
    chips: 0,
    mult: 0,
    damage: 0,
    cards: [],
    visible: false,
  })

  // ── Help overlay state (first-time tutorial) ───────────────────────
  const [showHelp, setShowHelp] = useState(() => {
    const seen = localStorage.getItem('poker-magic-help-seen')
    return !seen
  })

  const handlePlayCards = useCallback(() => {
    if (selectedCardIds.length < 5) return

    const cardsToPlay = player.hand.filter((c) =>
      selectedCardIds.includes(c.id),
    )
    if (cardsToPlay.length < 5) return

    // Evaluate poker hand via combat engine
    let evaluation, result
    try {
      evaluation = findBestHand(cardsToPlay)
      result = calculateDamage(cardsToPlay, {
        classAbility: 'none',
        classMultiplier: 1,
        relicMultiplier: 1,
        bonusDamage: 0,
        buffs: {},
      }, {
        shield: enemy.shield,
        buffs: {},
      })
    } catch {
      return
    }

    setHandResult({
      handName: handTypeName(evaluation.handType),
      handType: evaluation.handType,
      chips: result.breakdown.baseChips,
      mult: result.breakdown.baseMult,
      damage: result.totalDamage,
      cards: evaluation.cards,
      visible: true,
    })

    const playEntries: PlayingCardState[] = cardsToPlay.map((card, i) => ({
      card,
      stage: 'playing' as const,
      slotIndex: Math.min(i, 2),
    }))

    setPlayingCards(playEntries)
    animSeq.start('playing')

    // Remove played cards from hand
    setDealState((prev) => ({
      ...prev,
      inHand: prev.inHand.filter(
        (c) => !selectedCardIds.includes(c.id),
      ),
    }))

    // Settle cards after arc animation completes
    setTimeout(() => {
      setPlayingCards((prev) =>
        prev.map((p) =>
          p.stage === 'playing' ? { ...p, stage: 'resolved' } : p,
        ),
      )
      animSeq.advance()

      // Apply damage from combat engine calculation
  applyDamage('enemy', result.totalDamage)
  discardCards(selectedCardIds)
  playHand()
}, 1500)
  }, [selectedCardIds, player.hand, enemy.shield, animSeq, applyDamage])

  // Hide hand result when playing cards change (discard starts)
  useEffect(() => {
    if (playingCards.length === 0) return
    const allDiscarded = playingCards.every(
      (p) => p.stage === 'discarded',
    )
    if (allDiscarded) {
      setHandResult((prev) => ({ ...prev, visible: false }))
    }
  }, [playingCards])

  // ── Damage events ─────────────────────────────────────────────────
  const [damageEvents, setDamageEvents] = useState<DamageEvent[]>([])

  // Detect enemy health changes and spawn damage numbers
  useEffect(() => {
    const prevHealth = prevHealthRef.current

    if (enemy.health < prevHealth && gamePhase === 'playing') {
      const diff = prevHealth - enemy.health
      const isCrit = diff >= 6

      const newEvent: DamageEvent = {
        id: `dmg-${Date.now()}-${Math.random()}`,
        amount: diff,
        x: 50 + Math.random() * 20,
        y: 25 + Math.random() * 10,
        critical: isCrit,
        label: isCrit ? 'CRIT' : undefined,
      }
      setDamageEvents((prev) => [...prev, newEvent])

      const cleanup = setTimeout(() => {
        setDamageEvents((prev) =>
          prev.filter((e) => e.id !== newEvent.id),
        )
      }, 1500)

      prevHealthRef.current = enemy.health
      return () => clearTimeout(cleanup)
    }

    // Track health increases (heals, resets) without spawning events
    if (enemy.health !== prevHealth) {
      prevHealthRef.current = enemy.health
    }
  }, [enemy.health, gamePhase])

  // ── Discard state ─────────────────────────────────────────────────
  const [discardedCards, setDiscardedCards] = useState<Card[]>([])
  const [discardingCard, setDiscardingCard] = useState<Card | null>(null)
  const resolvingRef = useRef(false)

  // Auto-resolve settled cards → discard one by one
  useEffect(() => {
    if (playingCards.length === 0) return

    const allSettled = playingCards.every(
      (p) =>
        p.stage === 'resolved' ||
        p.stage === 'discarding' ||
        p.stage === 'discarded',
    )
    if (!allSettled) return

    const hasUnresolved = playingCards.some(
      (p) => p.stage !== 'discarding' && p.stage !== 'discarded',
    )
    if (!hasUnresolved) return
    if (resolvingRef.current) return
    resolvingRef.current = true

    const timer = setTimeout(() => {
      const toDiscard = playingCards.filter(
        (p) => p.stage === 'resolved',
      )

      toDiscard.forEach((entry, i) => {
        setTimeout(() => {
          setDiscardingCard(entry.card)
          setPlayingCards((prev) =>
            prev.map((p) =>
              p.card.id === entry.card.id
                ? { ...p, stage: 'discarding' }
                : p,
            ),
          )

          setTimeout(() => {
            setDiscardedCards((prev) => [...prev, entry.card])
            setDiscardingCard(null)
            setPlayingCards((prev) =>
              prev.map((p) =>
                p.card.id === entry.card.id
                  ? { ...p, stage: 'discarded' }
                  : p,
              ),
            )
          }, 600)
        }, i * 400)
      })

      animSeq.advance()
      resolvingRef.current = false
    }, 2500)

    return () => {
      clearTimeout(timer)
      resolvingRef.current = false
    }
  }, [playingCards, animSeq])

  // ── Banner state ──────────────────────────────────────────────────
  const [banner, setBanner] = useState<BannerState | null>(null)

  // Show turn banner when turn changes
  useEffect(() => {
    if (turn === prevTurnRef.current) return
    prevTurnRef.current = turn

    setBanner({
      text: `Turn ${turn}`,
      position: 'top',
      style: 'neutral',
      subtitle: 'Draw a card and play your hand',
    })
    const timer = setTimeout(() => setBanner(null), 2000)
    return () => clearTimeout(timer)
  }, [turn])

  // Show game over banner
  useEffect(() => {
    if (gamePhase !== 'finished') return

    const isVictory = useGameStore.getState().winner === 'Player'
    setBanner({
      text: isVictory ? 'Victory!' : 'Defeat',
      position: 'top',
      style: isVictory ? 'victory' : 'defeat',
      subtitle: isVictory
        ? 'You have triumphed!'
        : 'Better luck next time...',
    })
  }, [gamePhase])

  // ── Card click handler ────────────────────────────────────────────
  const handleCardClick = useCallback(
    (card: Card) => {
      if (selectedCardIds.includes(card.id)) {
        deselectCard(card.id)
      } else {
        selectCard(card.id)
      }
    },
    [selectedCardIds, selectCard, deselectCard],
  )

  // ── Derive play-slot data (pure computation, no side effects) ─────
  const activePlayingCards = playingCards.filter(
    (p) => p.stage !== 'discarded',
  )
  const playSlotCards: PlaySlotCard[] = activePlayingCards.map((p) => ({
    card: p.card,
    slotIndex: p.slotIndex,
    playing: p.stage === 'playing',
    resolved: p.stage === 'resolved',
  }))

  // ── Hand Preview: evaluate currently selected cards ────────────────
  const selectedCards = useMemo(
    () => player.hand.filter((c) => selectedCardIds.includes(c.id)),
    [player.hand, selectedCardIds]
  )
  const handPreview = useMemo(() => {
    if (selectedCards.length < 5) return null
    const evalResult = findBestHand(selectedCards)
    return {
      handName: handTypeName(evalResult.handType),
      handType: evalResult.handType,
      cards: evalResult.cards,
      hint: getHandHint(selectedCards),
    }
  }, [selectedCards])

  // ─── Helper: smart hints for incomplete hands ────────────────────────

function getHandHint(cards: readonly Card[]): string | null {
  if (cards.length === 0) return null
  const suits = cards.map((c) => c.suit)
  const ranks = cards.map((c) => c.rank)
  const suitCounts = suits.reduce((acc, s) => {
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
  const rankCounts = ranks.reduce((acc, r) => {
    acc[r] = (acc[r] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
  const maxSuit = Math.max(...Object.values(suitCounts))
  const maxRank = Math.max(...Object.values(rankCounts))

  // Flush potential
  if (maxSuit >= 3) {
    const need = 5 - maxSuit
    const suitName = Object.entries(suitCounts).find(([, v]) => v === maxSuit)?.[0] ?? ''
    return `Need ${need} more ${suitName} for Flush`
  }
  // Pair / Trips potential
  if (maxRank >= 2) {
    const rankName = Object.entries(rankCounts).find(([, v]) => v === maxRank)?.[0] ?? ''
    if (maxRank === 2) return `Pair of ${rankName}s — need 3 more for Full House`
    if (maxRank === 3) return `Three ${rankName}s — need a pair for Full House`
  }
  // Straight potential (simplified)
  const values = cards.map((c) => c.rank === 'A' ? 14 : parseInt(c.rank) || (c.rank === 'J' ? 11 : c.rank === 'Q' ? 12 : c.rank === 'K' ? 13 : 0)).sort((a, b) => a - b)
  if (values.length >= 3) {
    const gaps = values[values.length - 1] - values[0]
    if (gaps <= 4) return `Potential Straight — ${5 - values.length} more in sequence`
  }
  return `Select ${5 - cards.length} more cards`
}

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="relative mx-auto w-full max-w-6xl">
      {/* First-time help overlay */}
      {showHelp && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => { localStorage.setItem('poker-magic-help-seen', 'true'); setShowHelp(false); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="relative w-full max-w-xl mx-4 rounded-2xl border border-gold/30 bg-gradient-to-b from-surface via-[#0d1117] to-surface-light p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { localStorage.setItem('poker-magic-help-seen', 'true'); setShowHelp(false); }}
              className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
            <h2 className="mb-2 font-game text-2xl font-bold text-gold text-center">How to Play</h2>
            <div className="space-y-4 text-sm text-gray-300">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center text-gold text-xs font-bold">1</span>
                <div>
                  <p className="font-semibold text-white">Pick a Hero</p>
                  <p className="text-xs text-gray-500">Each has a unique ability</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center text-gold text-xs font-bold">2</span>
                <div>
                  <p className="font-semibold text-white">Select Cards</p>
                  <p className="text-xs text-gray-500">Click 3–5 cards in your hand — they glow gold</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center text-gold text-xs font-bold">3</span>
                <div>
                  <p className="font-semibold text-white">Make Poker Hands</p>
                  <p className="text-xs text-gray-500">Pair, Flush, Straight, Full House... higher = more damage</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center text-gold text-xs font-bold">4</span>
                <div>
                  <p className="font-semibold text-white">Press <span className="text-gold">Play</span></p>
                  <p className="text-xs text-gray-500">Cards arc to center → hand evaluated → damage dealt</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center text-gold text-xs font-bold">5</span>
                <div>
                  <p className="font-semibold text-white">Press <span className="text-gold">End Turn</span></p>
                  <p className="text-xs text-gray-500">Enemy plays back → repeat until someone falls</p>
                </div>
              </div>
              <div className="pt-2 border-t border-white/10">
                <p className="text-xs text-gray-500 text-center">
                  💡 Hint panel below shows what your cards will make
                </p>
              </div>
            </div>
            <button
              onClick={() => { localStorage.setItem('poker-magic-help-seen', 'true'); setShowHelp(false); }}
              className="mt-6 w-full rounded-lg bg-gold/20 py-2 font-game text-sm font-bold text-gold hover:bg-gold/30 transition-colors"
            >
              Got it, let's duel!
            </button>
          </motion.div>
        </motion.div>
      )}

      {/* Phase banners */}
      {banner && (
        <PhaseBanner
          text={banner.text}
          visible={!!banner}
          position={banner.position}
          style={banner.style}
          subtitle={banner.subtitle}
          autoDismissMs={gamePhase === 'finished' ? 0 : 2000}
          onDismiss={() => setBanner(null)}
        />
      )}

      {/* Screen shake layer (from damage events) */}
      <motion.div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-surface via-[#0d1117] to-surface-light p-6 shadow-2xl">
        {/* ══════════ ENEMY SECTION ══════════ */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-widest text-gray-500">
              Enemy
            </span>
            <h2 className="font-game text-xl font-bold text-white">
              {enemy.name}
            </h2>
          </div>

          {/* Enemy HP */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-48 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background:
                      'linear-gradient(90deg, #ef4444, #dc2626)',
                  }}
                  initial={false}
                  animate={{
                    width: `${(enemy.health / Math.max(enemy.maxHealth, 1)) * 100}%`,
                  }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
              <span className="font-game text-sm text-white">
                {enemy.health}/{enemy.maxHealth}
              </span>
            </div>

            {enemy.shield > 0 && (
              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
                ✦ {enemy.shield}
              </span>
            )}
          </div>
        </div>

        {/* Enemy board slots — static placeholder */}
        <div className="mb-10 flex justify-center gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={`eslot-${i}`}
              className="flex h-28 w-20 items-center justify-center rounded-lg border-2 border-dashed border-white/5"
            >
              <span className="text-xs text-white/10">{i + 1}</span>
            </div>
          ))}
        </div>

        {/* ══════════ CENTER — PLAY SLOTS ══════════ */}
        <div className="relative mb-2 mt-4 flex flex-col items-center">
          {/* Hand Preview: shows what selected cards would make */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: selectedCardIds.length > 0 ? 1 : 0, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="mb-3 w-full max-w-xl"
          >
            {handPreview && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-game text-sm font-bold tracking-wider ${HAND_TIER_COLORS[handPreview.handType] ?? 'text-white'}`}>
                    {selectedCardIds.length === 5 ? 'Ready: ' : 'Will make: '}
                    {handPreview.handName}
                  </span>
                  {selectedCardIds.length < 5 && (
                    <span className="text-xs text-gray-500">
                      {5 - selectedCardIds.length} more card{5 - selectedCardIds.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {handPreview.hint && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="text-xs text-gray-400 italic"
                  >
                    💡 {handPreview.hint}
                  </motion.p>
                )}
              </div>
            )}
            {selectedCardIds.length > 0 && selectedCardIds.length < 5 && !handPreview && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center">
                <span className="text-xs text-gray-400">
                  Select {5 - selectedCardIds.length} more card{5 - selectedCardIds.length > 1 ? 's' : ''} to form a poker hand
                </span>
              </div>
            )}
          </motion.div>

          <div className="relative mb-2 mt-4 flex justify-center">
            <PlaySlot
              cards={playSlotCards}
              slotCount={3}
            />
          </div>
        </div>

        {/* ══════════ HAND RESULT ══════════ */}
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: handResult.visible ? 1 : 0, y: handResult.visible ? 0 : -20, scale: handResult.visible ? 1 : 0.9 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="mb-6 flex flex-col items-center"
        >
          {handResult.visible && (
            <motion.div
              initial={{ boxShadow: '0 0 0px rgba(255,215,0,0)' }}
              animate={{ boxShadow: '0 0 40px rgba(255,215,0,0.15)' }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="inline-flex flex-col items-center gap-2 rounded-2xl border-2 border-gold/30 bg-gradient-to-b from-gold/[0.08] to-gold/[0.02] px-10 py-5 backdrop-blur-md"
            >
              {/* Hand name with glow */}
              <span className={`font-game text-2xl font-bold tracking-widest drop-shadow-lg ${HAND_TIER_COLORS[handResult.handType] ?? 'text-white'}`}
                style={{ textShadow: '0 0 20px currentColor' }}
              >
                {handResult.handName}
              </span>
              {/* Formula: chips × mult = damage */}
              <div className="flex items-center gap-3 text-sm text-gray-300">
                <span className="font-mono font-bold text-yellow-300">{handResult.chips}</span>
                <span className="text-gray-600">chips</span>
                <span className="text-lg text-gray-600">×</span>
                <span className="font-mono font-bold text-purple-300">{handResult.mult}</span>
                <span className="text-gray-600">mult</span>
                <span className="text-lg text-gray-600">=</span>
                <span className="font-mono text-xl font-bold text-green-400">{handResult.damage}</span>
                <span className="text-green-400/70">damage</span>
              </div>
              {/* Best cards used in the hand */}
              <div className="mt-1 flex gap-2">
                {handResult.cards.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1 font-mono text-xs font-semibold text-white shadow-sm"
                  >
                    <span className="text-gold">{c.rank}</span>
                    <span className="text-gray-400">{c.suit[0].toUpperCase()}</span>
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* ══════════ PLAYER SECTION ══════════ */}
        <div className="mb-6 flex justify-center gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={`pslot-${i}`}
              className="flex h-28 w-20 items-center justify-center rounded-lg border-2 border-dashed border-white/5"
            >
              <span className="text-xs text-white/10">{i + 1}</span>
            </div>
          ))}
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-widest text-gray-500">
              Player
            </span>
            <h2 className="font-game text-xl font-bold text-white">
              {player.name}
            </h2>
          </div>

          {/* Player HP + Mana */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-48 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background:
                      'linear-gradient(90deg, #22c55e, #16a34a)',
                  }}
                  initial={false}
                  animate={{
                    width: `${(player.health / Math.max(player.maxHealth, 1)) * 100}%`,
                  }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
              <span className="font-game text-sm text-white">
                {player.health}/{player.maxHealth}
              </span>
            </div>

            {/* Mana crystals */}
            <div className="flex gap-1">
              {Array.from({
                length: player.maxMana,
              }).map((_, i) => (
                <div
                  key={`mana-${i}`}
                  className={`h-4 w-4 rotate-45 rounded-sm ${
                    i < player.mana
                      ? 'bg-purple-400 shadow-lg shadow-purple-400/30'
                      : 'bg-gray-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ══════════ HAND + DECK + DISCARD ══════════ */}
        <div className="flex items-end justify-between gap-4">
          {/* Left: Deck + hand */}
          <div className="flex-1">
            <DeckArea
              state={dealState}
              deckCount={player.deck.length}
              onCardClick={handleCardClick}
              selectedCardIds={selectedCardIds}
              staggerMs={60}
              initialDelay={0.3}
            />
          </div>

          {/* Right: Action buttons + discard */}
          <div className="flex flex-col items-end gap-4">
            {/* Play button */}
            <div className="flex gap-2">
              <motion.button
                onClick={handlePlayCards}
                disabled={
                  selectedCardIds.length < 5 ||
                  gamePhase !== 'playing'
                }
                whileHover={
                  selectedCardIds.length > 0
                    ? { scale: 1.05 }
                    : undefined
                }
                whileTap={
                  selectedCardIds.length > 0
                    ? { scale: 0.96 }
                    : undefined
                }
                className={`rounded-lg px-5 py-2 font-game text-sm font-bold uppercase tracking-wider transition-colors ${
                  selectedCardIds.length > 0
                    ? 'cursor-pointer bg-gold/20 text-gold hover:bg-gold/30'
                    : 'cursor-not-allowed bg-white/5 text-gray-600'
                }`}
              >
                {selectedCardIds.length >= 5 ? `Play (${selectedCardIds.length})` : 'Select 5 cards'}
              </motion.button>

              <motion.button
                onClick={endTurn}
                disabled={gamePhase !== 'playing'}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-game text-sm text-gray-300 transition-colors hover:bg-white/10"
              >
                End Turn
              </motion.button>
            </div>

            {/* Discard pile */}
            <DiscardPile
              discarded={discardedCards}
              discarding={discardingCard}
            />
          </div>
        </div>
      </motion.div>

      {/* Damage numbers overlay */}
      <DamageNumbers events={damageEvents} />

      {/* ══════════ TIPS PANEL ══════════ */}
      <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-gray-500">
          {selectedCardIds.length === 0 ? (
            <span>💡 Click cards in your hand to select them, then press <span className="text-gold/70">Play</span></span>
          ) : (
            <span>💡 <span className="text-gold/70">{selectedCardIds.length}</span> card(s) selected — press <span className="text-gold/70">Play</span> to form a poker hand</span>
          )}
          <span>|</span>
          <span>Higher poker hand → more damage</span>
          <span>|</span>
          <span>Press <span className="text-gold/70">End Turn</span> when done</span>
        </div>
      </div>
    </div>
  )
}