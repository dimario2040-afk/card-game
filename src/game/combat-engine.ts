import type { Card } from '@/types'
import { findBestHand, HandType } from './hand-evaluator'
import type { HandType as HandTypeEnum } from './hand-evaluator'

// ─── Chip values for baseChips calculation ──────────────────────────

const CHIP_VALUES: Readonly<Record<string, number>> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 10,
  Q: 10,
  K: 10,
  A: 11,
} as const

// ─── Base multipliers per hand type ─────────────────────────────────

const HAND_BASE_MULT: Readonly<Record<HandTypeEnum, number>> = {
  [HandType.HIGH_CARD]: 1,
  [HandType.ONE_PAIR]: 2,
  [HandType.TWO_PAIR]: 2,
  [HandType.THREE_OF_A_KIND]: 3,
  [HandType.STRAIGHT]: 4,
  [HandType.FLUSH]: 4,
  [HandType.FULL_HOUSE]: 4,
  [HandType.FOUR_OF_A_KIND]: 7,
  [HandType.STRAIGHT_FLUSH]: 8,
  [HandType.ROYAL_FLUSH]: 10,
}

// ─── Exported types ─────────────────────────────────────────────────

export type ClassAbilityType =
  | 'none'
  | 'chain_lightning'
  | 'hell_fire'
  | 'shield_burst'

export interface AttackerModifiers {
  readonly classAbility: ClassAbilityType
  readonly classMultiplier: number
  readonly relicMultiplier: number
  readonly bonusDamage: number
  readonly buffs: Readonly<Record<string, number>>
}

export interface DefenderStats {
  readonly shield: number
  readonly buffs: Readonly<Record<string, number>>
}

export interface StatusEffect {
  readonly type: string
  readonly value: number
  readonly duration: number
}

export interface DamageBreakdown {
  readonly baseChips: number
  readonly baseMult: number
  readonly handType: HandTypeEnum
  readonly rawDamage: number
  readonly classMultiplier: number
  readonly relicMultiplier: number
  readonly abilityBonus: number
  readonly totalBeforeShield: number
  readonly shieldAbsorbed: number
  readonly shieldRemaining: number
  readonly healthDamage: number
  readonly statusEffectsApplied: readonly StatusEffect[]
  readonly totalDamage: number
}

export interface DamageResult {
  readonly totalDamage: number
  readonly breakdown: DamageBreakdown
}

// ─── Helpers ─────────────────────────────────────────────────────────

function chipValue(rank: string): number {
  return CHIP_VALUES[rank] ?? 0
}

function sumChips(cards: readonly Card[]): number {
  return cards.reduce((sum, c) => sum + chipValue(c.rank), 0)
}

/** Pure function: computes base chips and base mult from a hand of cards. */
function baseChipsAndMult(
  cards: readonly Card[],
): { chips: number; mult: number; handType: HandTypeEnum } {
  const evaluation = findBestHand(cards)
  return {
    chips: sumChips(evaluation.cards),
    mult: HAND_BASE_MULT[evaluation.handType],
    handType: evaluation.handType,
  }
}

// ─── Class ability calculators ──────────────────────────────────────

interface AbilityResult {
  bonusDamage: number
  effects: readonly StatusEffect[]
}

function calcChainLightning(hand: readonly Card[]): AbilityResult {
  // +3 per spade card in the full hand
  const spadeCount = hand.filter((c) => c.suit === 'spades').length
  return {
    bonusDamage: spadeCount * 3,
    effects: [],
  }
}

function calcHellFire(hand: readonly Card[]): AbilityResult {
  // +2 per face card (J, Q, K, A) — any non-numeric rank
  const faceCount = hand.filter((c) => isNaN(Number(c.rank))).length
  return {
    bonusDamage: faceCount * 2,
    effects: [{ type: 'burning', value: 2, duration: 2 }],
  }
}

function calcShieldBurst(defenderShield: number): AbilityResult {
  // +2x defender shield as bonus damage
  const bonus = defenderShield * 2
  return {
    bonusDamage: bonus,
    effects: bonus > 0
      ? [{ type: 'shield_shatter', value: 1, duration: 1 }]
      : [],
  }
}

function resolveClassAbility(
  classAbility: ClassAbilityType,
  hand: readonly Card[],
  defenderShield: number,
): AbilityResult {
  switch (classAbility) {
    case 'chain_lightning':
      return calcChainLightning(hand)
    case 'hell_fire':
      return calcHellFire(hand)
    case 'shield_burst':
      return calcShieldBurst(defenderShield)
    case 'none':
      return { bonusDamage: 0, effects: [] }
  }
}

// ─── Main entry point ───────────────────────────────────────────────

/**
 * Calculates combat damage from a played hand against a defender.
 *
 * Formula:
 *   rawDamage = baseChips(hand) * baseMult(hand)
 *   total    = rawDamage * classMultiplier * relicMultiplier + bonusDamage + abilityBonus
 *   healthDamage = max(0, total - shield) adjusted by defender buffs
 *
 * All inputs are typed and immutable. No side effects, no UI/state coupling.
 */
export function calculateDamage(
  hand: readonly Card[],
  attackerModifiers: AttackerModifiers,
  defenderStats: DefenderStats,
): DamageResult {
  // 1. Base damage from hand
  const { chips, mult, handType } = baseChipsAndMult(hand)
  const rawDamage = chips * mult

  // 2. Class ability
  const abilityResult = resolveClassAbility(
    attackerModifiers.classAbility,
    hand,
    defenderStats.shield,
  )

  // 3. Stack multipliers and bonuses
  const afterClassMult = rawDamage * attackerModifiers.classMultiplier
  const afterRelicMult = afterClassMult * attackerModifiers.relicMultiplier
  const totalBeforeShield =
    afterRelicMult + attackerModifiers.bonusDamage + abilityResult.bonusDamage

  // 4. Shield absorption
  const shieldAbsorbed = Math.min(defenderStats.shield, totalBeforeShield)
  const shieldRemaining = defenderStats.shield - shieldAbsorbed
  const healthDamageBeforeBuffs = Math.max(0, totalBeforeShield - shieldAbsorbed)

  // 5. Defender buff modifiers (vulnerable / fortified)
  const vulnerable = defenderStats.buffs['vulnerable'] ?? 0
  const fortified = defenderStats.buffs['fortified'] ?? 0
  const healthDamage = Math.max(
    0,
    Math.round(
      healthDamageBeforeBuffs *
        (1 + vulnerable * 0.5) *
        (1 - fortified * 0.25),
    ),
  )

  return {
    totalDamage: healthDamage,
    breakdown: {
      baseChips: chips,
      baseMult: mult,
      handType,
      rawDamage,
      classMultiplier: attackerModifiers.classMultiplier,
      relicMultiplier: attackerModifiers.relicMultiplier,
      abilityBonus: abilityResult.bonusDamage,
      totalBeforeShield,
      shieldAbsorbed,
      shieldRemaining,
      healthDamage,
      statusEffectsApplied: abilityResult.effects,
      totalDamage: healthDamage,
    },
  }
}
