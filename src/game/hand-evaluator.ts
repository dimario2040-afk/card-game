import type { Card } from '@/types'

/**
 * Numeric rank values for comparison purposes.
 * Ace is 14 normally; treated as 1 for ace-low straights.
 */
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

/** All poker hand types, ordered weakest to strongest. */
export const HandType = {
  HIGH_CARD: 0,
  ONE_PAIR: 1,
  TWO_PAIR: 2,
  THREE_OF_A_KIND: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR_OF_A_KIND: 7,
  STRAIGHT_FLUSH: 8,
  ROYAL_FLUSH: 9,
} as const

export type HandType = (typeof HandType)[keyof typeof HandType]

/** Reverse map: numeric value -> name (for display / testing). */
export const HAND_TYPE_NAMES: Record<number, string> = {
  [HandType.HIGH_CARD]: 'HIGH_CARD',
  [HandType.ONE_PAIR]: 'ONE_PAIR',
  [HandType.TWO_PAIR]: 'TWO_PAIR',
  [HandType.THREE_OF_A_KIND]: 'THREE_OF_A_KIND',
  [HandType.STRAIGHT]: 'STRAIGHT',
  [HandType.FLUSH]: 'FLUSH',
  [HandType.FULL_HOUSE]: 'FULL_HOUSE',
  [HandType.FOUR_OF_A_KIND]: 'FOUR_OF_A_KIND',
  [HandType.STRAIGHT_FLUSH]: 'STRAIGHT_FLUSH',
  [HandType.ROYAL_FLUSH]: 'ROYAL_FLUSH',
}

/**
 * Result of evaluating a 5-card poker hand.
 * `score` is a single sortable integer: higher = better hand.
 */
export interface HandEvaluation {
  readonly handType: HandType
  readonly score: number
  readonly cards: readonly Card[]
}

// ─── Rank helpers ─────────────────────────────────────────────────

/** Maps a rank string to its numeric value (2-14). */
function rankValue(rank: string): number {
  return RANK_VALUES[rank]
}

/** Returns the numeric values sorted descending, with ace-low (1) when present. */
function sortedRankValues(cards: readonly Card[]): readonly number[] {
  return cards
    .map((c) => rankValue(c.rank))
    .sort((a, b) => b - a)
}

/** Builds a frequency map: rankValue -> count, sorted desc by count then rank. */
function rankCounts(cards: readonly Card[]): ReadonlyArray<readonly [number, number]> {
  const freq = new Map<number, number>()
  for (const c of cards) {
    const v = rankValue(c.rank)
    freq.set(v, (freq.get(v) ?? 0) + 1)
  }
  return [...freq.entries()].sort((a, b) => {
    const countDiff = b[1] - a[1]
    return countDiff !== 0 ? countDiff : b[0] - a[0]
  })
}

/** Checks whether all cards share the same suit. */
function isFlush(cards: readonly Card[]): boolean {
  return cards.every((c) => c.suit === cards[0].suit)
}

/**
 * Detects a straight and returns the high card value, or 0 if not a straight.
 * Handles ace-low (A-2-3-4-5) correctly.
 */
function straightHigh(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => b - a)
  // Normal straight
  if (sorted[0] - sorted[4] === 4 && new Set(sorted).size === 5) {
    return sorted[0]
  }
  // Ace-low straight (A-2-3-4-5)
  if (
    sorted[0] === 14 &&
    sorted[1] === 5 &&
    sorted[2] === 4 &&
    sorted[3] === 3 &&
    sorted[4] === 2
  ) {
    return 5
  }
  return 0
}

// ─── Combination generation ─────────────────────────────────────────

/** Generates all k-combinations from items using recursion. */
function combinations<T>(items: readonly T[], k: number): readonly (readonly T[])[] {
  if (k === 0) return [[]]
  if (items.length < k) return []
  const result: T[][] = []
  const combos = (start: number, chosen: T[]): void => {
    if (chosen.length === k) {
      result.push([...chosen])
      return
    }
    for (let i = start; i <= items.length - (k - chosen.length); i++) {
      chosen.push(items[i])
      combos(i + 1, chosen)
      chosen.pop()
    }
  }
  combos(0, [])
  return result
}

// ─── Score packing ──────────────────────────────────────────────────

/**
 * Scores are packed into a single integer:
 *
 *   bits 27-24: handType (4 bits, value 0-9)
 *   bits 23-0:  kicker ranks (6 slots × 4 bits each)
 *
 * This guarantees any hand of higher type beats any hand of lower type,
 * and tiebreaking within a type works by simple > comparison.
 */
const HAND_TYPE_SHIFT = 24
const SLOT_BITS = 4
const MAX_SLOTS = 6

function packScore(handType: HandType, ...kickers: readonly number[]): number {
  let score = handType << HAND_TYPE_SHIFT
  for (let i = 0; i < Math.min(kickers.length, MAX_SLOTS); i++) {
    score |= kickers[i] << (HAND_TYPE_SHIFT - (i + 1) * SLOT_BITS)
  }
  return score
}

// ─── Individual evaluators (each expects exactly 5 cards) ───────────

function evalHighCard(cards: readonly Card[]): HandEvaluation {
  const values = sortedRankValues(cards)
  return {
    handType: HandType.HIGH_CARD,
    score: packScore(HandType.HIGH_CARD, ...values),
    cards,
  }
}

function evalOnePair(
  cards: readonly Card[],
  counts: ReadonlyArray<readonly [number, number]>,
): HandEvaluation {
  const pairRank = counts[0][0]
  const kickers = counts.slice(1).map(([r]) => r)
  return {
    handType: HandType.ONE_PAIR,
    score: packScore(HandType.ONE_PAIR, pairRank, ...kickers),
    cards,
  }
}

function evalTwoPair(
  cards: readonly Card[],
  counts: ReadonlyArray<readonly [number, number]>,
): HandEvaluation {
  const highPair = counts[0][0]
  const lowPair = counts[1][0]
  const kicker = counts[2][0]
  return {
    handType: HandType.TWO_PAIR,
    score: packScore(HandType.TWO_PAIR, highPair, lowPair, kicker),
    cards,
  }
}

function evalThreeOfAKind(
  cards: readonly Card[],
  counts: ReadonlyArray<readonly [number, number]>,
): HandEvaluation {
  const triple = counts[0][0]
  const kickers = counts.slice(1).map(([r]) => r)
  return {
    handType: HandType.THREE_OF_A_KIND,
    score: packScore(HandType.THREE_OF_A_KIND, triple, ...kickers),
    cards,
  }
}

function evalStraight(cards: readonly Card[], high: number): HandEvaluation {
  return {
    handType: HandType.STRAIGHT,
    score: packScore(HandType.STRAIGHT, high),
    cards,
  }
}

function evalFlush(cards: readonly Card[]): HandEvaluation {
  const values = sortedRankValues(cards)
  return {
    handType: HandType.FLUSH,
    score: packScore(HandType.FLUSH, ...values),
    cards,
  }
}

function evalFullHouse(
  cards: readonly Card[],
  counts: ReadonlyArray<readonly [number, number]>,
): HandEvaluation {
  return {
    handType: HandType.FULL_HOUSE,
    score: packScore(HandType.FULL_HOUSE, counts[0][0], counts[1][0]),
    cards,
  }
}

function evalFourOfAKind(
  cards: readonly Card[],
  counts: ReadonlyArray<readonly [number, number]>,
): HandEvaluation {
  return {
    handType: HandType.FOUR_OF_A_KIND,
    score: packScore(HandType.FOUR_OF_A_KIND, counts[0][0], counts[1][0]),
    cards,
  }
}

function evalStraightFlush(cards: readonly Card[], high: number): HandEvaluation {
  // Royal flush is A-high straight flush
  if (high === 14) {
    return {
      handType: HandType.ROYAL_FLUSH,
      score: packScore(HandType.ROYAL_FLUSH),
      cards,
    }
  }
  return {
    handType: HandType.STRAIGHT_FLUSH,
    score: packScore(HandType.STRAIGHT_FLUSH, high),
    cards,
  }
}

// ─── 5-card evaluator ───────────────────────────────────────────────

/**
 * Evaluates a single 5-card hand and returns its HandEvaluation.
 */
export function evaluate5(cards: readonly Card[]): HandEvaluation {
  const values = sortedRankValues(cards)
  const counts = rankCounts(cards)
  const flush = isFlush(cards)
  const straight = straightHigh(values)

  const isStraight = straight !== 0

  if (flush && isStraight) {
    return evalStraightFlush(cards, straight)
  }

  const topCount = counts[0][1]

  if (topCount === 4) {
    return evalFourOfAKind(cards, counts)
  }

  if (topCount === 3 && counts.length === 2) {
    return evalFullHouse(cards, counts)
  }

  if (flush) {
    return evalFlush(cards)
  }

  if (isStraight) {
    return evalStraight(cards, straight)
  }

  if (topCount === 3) {
    return evalThreeOfAKind(cards, counts)
  }

  if (topCount === 2 && counts.length === 3) {
    return evalTwoPair(cards, counts)
  }

  if (topCount === 2) {
    return evalOnePair(cards, counts)
  }

  return evalHighCard(cards)
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Given an array of cards (any size >= 5), finds the best possible
 * 5-card poker hand by evaluating all C(n,5) combinations.
 *
 * Returns an `HandEvaluation` with the highest hand type and score,
 * using standard poker ranking with ace-low straight support.
 */
export function findBestHand(cards: readonly Card[]): HandEvaluation {
  if (cards.length < 1) {
    throw new Error("At least 1 card required");
  }
  // Упрощенная логика: если < 5 карт, оцениваем как есть (напр. старшая карта или пара)
  // В полноценном покерном движке это сложно, для MVP/дуэли сделаем заглушку-оценку
  if (cards.length < 5) {
      const score = cards.reduce((sum, card) => sum + rankValue(card.rank), 0);
      return { 
          handType: HandType.HIGH_CARD, 
          score, 
          cards 
      }; 
  }

  if (cards.length === 5) {
    return evaluate5(cards)
  }

  const combos = combinations(cards, 5)
  let best: HandEvaluation | null = null

  for (const combo of combos) {
    const evaluation = evaluate5(combo)
    if (best === null || evaluation.score > best.score) {
      best = evaluation
    }
  }

  return best!
}
