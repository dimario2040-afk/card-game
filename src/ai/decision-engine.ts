import type { Card } from '@/types'
import { findBestHand, HandType } from '@/game/hand-evaluator'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AIPersonality = 'aggro' | 'balanced' | 'defensive'

export interface AIContext {
  readonly hand: readonly Card[]
  readonly health: number
  readonly maxHealth: number
  readonly mana: number
  readonly maxMana: number
  readonly personality: AIPersonality
}

export interface AIHeuristics {
  readonly handStrengthScore: number
  readonly holdPotential: number
  readonly aggressionFactor: number
  readonly classPreference: number
}

export interface AIDecision {
  readonly playCards: readonly Card[]
  readonly discardCards: readonly Card[]
  readonly useAbility: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RANK_VALUES: Readonly<Record<string, number>> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
} as const

/**
 * Personality-based thresholds for playing cards, discarding cards,
 * and using abilities. Aggro plays low, defensive plays high.
 * `abilityManaRatio` is the minimum mana/maxMana ratio to use an ability.
 */
/**
 * Base strength for each HandType (0-9) on a 0-100 scale.
 * Gives proper spread: high card is weak (~8), pair is decent (~25),
 * up to royal flush (100). Within each type the packed score kickers
 * add granularity.
 */
const HAND_TYPE_STRENGTH: readonly number[] = [
  8,  // HIGH_CARD
  25, // ONE_PAIR
  40, // TWO_PAIR
  50, // THREE_OF_A_KIND
  60, // STRAIGHT
  70, // FLUSH
  80, // FULL_HOUSE
  90, // FOUR_OF_A_KIND
  97, // STRAIGHT_FLUSH
  100, // ROYAL_FLUSH
] as const

/**
 * Maps a poker HandType + packed score to a 0-100 strength value.
 * Uses base type strength plus granularity from the kicker bits.
 */
export function handTypeStrength(handType: HandType, score: number): number {
  const base = HAND_TYPE_STRENGTH[handType] ?? 8
  const nextBase = HAND_TYPE_STRENGTH[Math.min(handType + 1, 9)] ?? 100
  const span = Math.max(1, nextBase - base)

  // Lower 24 bits encode the kicker values; normalise within this type's span
  const kickerBits = score & 0xffffff
  const maxKicker = 0xffffff
  return base + (kickerBits / maxKicker) * span
}

const PERSONALITY_CONFIG = {
  aggro: {
    playThreshold: 30,
    discardThreshold: 20,
    abilityManaRatio: 0.3,
  },
  balanced: {
    playThreshold: 45,
    discardThreshold: 35,
    abilityManaRatio: 0.5,
  },
  defensive: {
    playThreshold: 60,
    discardThreshold: 45,
    abilityManaRatio: 0.7,
  },
} as const satisfies Record<AIPersonality, {
  playThreshold: number
  discardThreshold: number
  abilityManaRatio: number
}>

// The maximum hand size before the AI starts discarding.
const MAX_HAND_SIZE = 7

// ---------------------------------------------------------------------------
// Rank helpers
// ---------------------------------------------------------------------------

function rankValue(rank: string): number {
  return RANK_VALUES[rank] ?? 0
}

// ---------------------------------------------------------------------------
// Heuristic: Hand Strength Score  (0–100)
// ---------------------------------------------------------------------------

/**
 * Evaluates the overall strength of the current hand.
 * For 5+ cards uses the poker hand evaluator; for fewer cards
 * scores by summing normalised rank values of the top cards.
 *
 * Returns a value from 0 (worst) to 100 (best).
 */
export function calculateHandStrength(hand: readonly Card[]): number {
  if (hand.length === 0) return 0

  if (hand.length >= 5) {
    const best = findBestHand(hand)
    return handTypeStrength(best.handType, best.score)
  }

  // Fewer than 5 cards: score by existing combos and high cards
  const values = hand.map((c) => rankValue(c.rank))
  const maxVal = Math.max(...values)

  // Check for pairs
  const rankFreq = new Map<string, number>()
  for (const c of hand) {
    rankFreq.set(c.rank, (rankFreq.get(c.rank) ?? 0) + 1)
  }
  const hasPair = [...rankFreq.values()].some((c) => c >= 2)

  if (hasPair) {
    // Find the highest pair rank
    let pairRank = 0
    for (const [r, count] of rankFreq) {
      if (count >= 2) {
        pairRank = Math.max(pairRank, rankValue(r))
      }
    }
    // Pair baseline (~30) + rank bonus
    return 25 + (pairRank / 14) * 15
  }

  // High card only: scale by top card value (0–35)
  return (maxVal / 14) * 35
}

// ---------------------------------------------------------------------------
// Heuristic: Hold Potential  (0–100)
// ---------------------------------------------------------------------------

/**
 * Estimates how much the hand could improve on future turns.
 * Considers flush draws, pair/trip potential, and straight draws.
 *
 * Returns a value from 0 (no upside) to 100 (high upside).
 */
export function calculateHoldPotential(hand: readonly Card[]): number {
  if (hand.length === 0) return 0

  // ---- Flush potential (0–50) ----
  const suitCounts = new Map<string, number>()
  for (const c of hand) {
    suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1)
  }
  const maxSuitCount = Math.max(...suitCounts.values(), 0)
  const flushPotential = (maxSuitCount / hand.length) * 50

  // ---- Pair / trip potential (0–30) ----
  const rankFreq = new Map<string, number>()
  for (const c of hand) {
    rankFreq.set(c.rank, (rankFreq.get(c.rank) ?? 0) + 1)
  }
  const duplicateCount = [...rankFreq.values()].filter((c) => c >= 2).length
  const pairPotential = Math.min(duplicateCount * 15, 30)

  // ---- Straight potential (0–20) ----
  const distinctValues = [
    ...new Set(hand.map((c) => rankValue(c.rank))),
  ].sort((a, b) => a - b)

  let longestRun = 1
  let currentRun = 1
  for (let i = 1; i < distinctValues.length; i++) {
    const prev = distinctValues[i - 1]!
    const curr = distinctValues[i]!
    if (curr - prev === 1) {
      currentRun++
      longestRun = Math.max(longestRun, currentRun)
    } else {
      currentRun = 1
    }
  }

  // Ace-low straight check: if hand has A and 2-3-4-5 sequence
  if (
    distinctValues.includes(14) &&
    distinctValues.slice(0, 4).every((v, i) => v === 2 + i)
  ) {
    longestRun = Math.max(longestRun, 5)
  }

  const straightPotential =
    longestRun >= 3 ? ((longestRun - 2) / 3) * 20 : 0

  return Math.min(flushPotential + pairPotential + straightPotential, 100)
}

// ---------------------------------------------------------------------------
// Heuristic: Aggression Factor  (0–1)
// ---------------------------------------------------------------------------

/**
 * Derives an aggression factor from the entity's current health ratio.
 * Higher HP → more aggressive; lower HP → more defensive.
 */
export function calculateAggressionFactor(
  health: number,
  maxHealth: number,
): number {
  if (maxHealth <= 0) return 0.5
  return Math.max(0, Math.min(1, health / maxHealth))
}

// ---------------------------------------------------------------------------
// Heuristic: Class Preference  (0–100)
// ---------------------------------------------------------------------------

/**
 * Measures how well the hand matches the AI's class preference.
 * Aggro prefers high-rank (face) cards → offensive style.
 * Defensive prefers mid-rank cards → balanced/control style.
 * Balanced is neutral.
 */
export function calculateClassPreference(
  hand: readonly Card[],
  personality: AIPersonality,
): number {
  if (hand.length === 0) return 50

  const avgRank =
    hand.reduce((sum, c) => sum + rankValue(c.rank), 0) / hand.length

  switch (personality) {
    case 'aggro':
      // Prefer high average rank (>8 -> face cards)
      return Math.min(100, (avgRank / 14) * 100)
    case 'defensive':
      // Prefer mid-range ranks (5–10)
      return 100 - Math.abs(avgRank - 7.5) * 8
    case 'balanced':
      return 50
  }
}

// ---------------------------------------------------------------------------
// Scoring an individual card for play/discard decisions
// ---------------------------------------------------------------------------

/**
 * Scores a single card in context of the whole hand. Higher = more valuable.
 */
function scoreCard(
  card: Card,
  hand: readonly Card[],
  personality: AIPersonality,
): number {
  const base = (rankValue(card.rank) / 14) * 50 // 0–50 base by rank

  // Suit synergy bonus (0–20)
  const sameSuitCount = hand.filter((c) => c.suit === card.suit).length
  const suitBonus = ((sameSuitCount - 1) / Math.max(hand.length - 1, 1)) * 20

  // Rank duplicate bonus (0–20)
  const sameRankCount = hand.filter((c) => c.rank === card.rank).length
  const pairBonus = Math.min((sameRankCount - 1) * 10, 20)

  // Personality class preference (0–10)
  const classScore = calculateClassPreference([card], personality) / 10

  return Math.min(base + suitBonus + pairBonus + classScore, 100)
}

// ---------------------------------------------------------------------------
// Public API: decideAction
// ---------------------------------------------------------------------------

/**
 * The main AI decision function.
 *
 * Evaluates the hand, applies heuristics and personality thresholds, and
 * returns which cards to play, which to discard, and whether to use an
 * ability.
 */
export function decideAction(context: AIContext): AIDecision {
  const { hand, health, maxHealth, mana, maxMana, personality } = context
  const config = PERSONALITY_CONFIG[personality]

  // ---- 1. Calculate heuristics ----
  const handStrength = calculateHandStrength(hand)
  const holdPotential = calculateHoldPotential(hand)
  const aggressionFactor = calculateAggressionFactor(health, maxHealth)

  // ---- 2. Adjust thresholds by aggression factor + hold potential ----
  // High HP lowers the play threshold (more aggressive play),
  // low HP raises it (more conservative).
  const aggressionModifier = (aggressionFactor - 0.5) * 20 // -10 to +10

  // High hold potential → hold cards (lower discard threshold = discard less).
  const holdModifier = ((holdPotential - 50) / 100) * 15 // -7.5 to +7.5

  const effectivePlayThreshold = Math.max(
    10,
    Math.min(90, config.playThreshold - aggressionModifier),
  )
  const effectiveDiscardThreshold = Math.max(
    5,
    Math.min(90, config.discardThreshold - holdModifier),
  )

  // ---- 3. Score each card ----
  const scored = hand.map((card) => ({
    card,
    score: scoreCard(card, hand, personality),
  }))

  // ---- 4. Try to find best poker hand (for 5+ cards) ----
  let playCards: readonly Card[] = []

  if (hand.length >= 5 && handStrength >= effectivePlayThreshold) {
    const best = findBestHand(hand)
    playCards = best.cards
  } else if (handStrength >= effectivePlayThreshold) {
    // Fewer than 5 cards but strong: play top scorers
    playCards = scored
      .filter((s) => s.score >= effectivePlayThreshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(hand.length, 5))
      .map((s) => s.card)
  }

  // ---- 5. Determine discard candidates ----
  // Cards not played that are below the discard threshold
  const playedIds = new Set(playCards.map((c) => c.id))
  const notPlayed = scored.filter((s) => !playedIds.has(s.card.id))

  const discardCards: Card[] = notPlayed
    .filter((s) => s.score < effectiveDiscardThreshold)
    .map((s) => s.card)

  // If hand exceeds max size, discard weakest non-played cards
  if (hand.length > MAX_HAND_SIZE) {
    const excess = hand.length - MAX_HAND_SIZE
    const sortedNotPlayed = [...notPlayed].sort((a, b) => a.score - b.score)
    for (const s of sortedNotPlayed) {
      if (discardCards.length >= excess) break
      if (!discardCards.find((c) => c.id === s.card.id)) {
        discardCards.push(s.card)
      }
    }
  }

  // ---- 6. Ability decision ----
  // Only use ability with cards in hand and meaningful health
  const manaRatio = maxMana > 0 ? mana / maxMana : 0
  const useAbility =
    hand.length > 0 &&
    mana > 0 &&
    manaRatio >= config.abilityManaRatio &&
    aggressionFactor > 0.3

  return {
    playCards,
    discardCards,
    useAbility,
  } satisfies AIDecision
}
