import { describe, it, expect } from 'vitest'
import type { Card } from '@/types'
import {
  type AIContext,
  calculateHandStrength,
  calculateHoldPotential,
  calculateAggressionFactor,
  calculateClassPreference,
  decideAction,
} from './decision-engine'

// ─── Fixture helpers ──────────────────────────────────────────────────

function card(id: string, suit: string, rank: string): Card {
  return { id, suit, rank }
}

const S = (rank: string) => card(`s${rank}`, 'spades', rank)
const H = (rank: string) => card(`h${rank}`, 'hearts', rank)
const D = (rank: string) => card(`d${rank}`, 'diamonds', rank)
const C = (rank: string) => card(`c${rank}`, 'clubs', rank)

function makeContext(
  overrides: Partial<AIContext> & { hand: readonly Card[] },
): AIContext {
  return {
    health: 30,
    maxHealth: 30,
    mana: 5,
    maxMana: 10,
    personality: 'balanced',
    ...overrides,
  }
}

// ─── Tests: Heuristics ────────────────────────────────────────────────

describe('calculateHandStrength', () => {
  it('returns 0 for an empty hand', () => {
    expect(calculateHandStrength([])).toBe(0)
  })

  it('scores a high-value 5-card hand (pair) above a high-card hand', () => {
    const pair = calculateHandStrength([S('A'), H('A'), D('5'), C('9'), S('Q')])
    const highCard = calculateHandStrength([S('2'), H('5'), D('9'), C('J'), S('Q')])
    expect(pair).toBeGreaterThan(highCard)
  })

  it('scores a flush higher than a pair', () => {
    const flush = calculateHandStrength([S('2'), S('5'), S('9'), S('J'), S('Q')])
    const pair = calculateHandStrength([S('A'), H('A'), D('5'), C('9'), S('Q')])
    expect(flush).toBeGreaterThan(pair)
  })

  it('scores a full house higher than a flush', () => {
    const fh = calculateHandStrength([S('K'), H('K'), D('K'), C('4'), S('4')])
    const flush = calculateHandStrength([S('2'), S('5'), S('9'), S('J'), S('Q')])
    expect(fh).toBeGreaterThan(flush)
  })

  it('scores a weaker hand lower than a stronger hand with < 5 cards', () => {
    const strong = calculateHandStrength([S('A'), H('K'), D('Q')])
    const weak = calculateHandStrength([S('2'), H('4'), D('7')])
    expect(strong).toBeGreaterThan(weak)
  })

  it('returns a score between 0 and 100', () => {
    const score = calculateHandStrength([S('A'), S('K'), S('Q'), S('J'), S('10')])
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})

describe('calculateHoldPotential', () => {
  it('returns 0 for an empty hand', () => {
    expect(calculateHoldPotential([])).toBe(0)
  })

  it('scores higher for 4 same-suit cards (flush draw)', () => {
    const flushDraw = calculateHoldPotential([S('2'), S('5'), S('9'), S('J'), H('A')])
    const scattered = calculateHoldPotential([S('2'), H('5'), D('9'), C('J'), S('A')])
    expect(flushDraw).toBeGreaterThan(scattered)
  })

  it('scores higher for paired cards (pair/trip potential)', () => {
    const paired = calculateHoldPotential([S('A'), H('A'), D('5'), C('9'), S('Q')])
    const unpaired = calculateHoldPotential([S('2'), H('5'), D('9'), C('J'), S('Q')])
    expect(paired).toBeGreaterThan(unpaired)
  })

  it('scores higher for consecutive ranks (straight draw)', () => {
    const straightDraw = calculateHoldPotential([S('5'), H('6'), D('7'), C('8'), S('K')])
    const scattered = calculateHoldPotential([S('2'), H('5'), D('9'), C('J'), S('Q')])
    expect(straightDraw).toBeGreaterThan(scattered)
  })

  it('returns a score between 0 and 100', () => {
    const score = calculateHoldPotential([S('2'), S('3'), S('4'), S('5'), S('6')])
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})

describe('calculateAggressionFactor', () => {
  it('returns 1.0 at full health', () => {
    expect(calculateAggressionFactor(30, 30)).toBe(1)
  })

  it('returns 0.5 at half health', () => {
    expect(calculateAggressionFactor(15, 30)).toBe(0.5)
  })

  it('returns 0 at zero health', () => {
    expect(calculateAggressionFactor(0, 30)).toBe(0)
  })

  it('clamps to 0–1 range', () => {
    expect(calculateAggressionFactor(-5, 30)).toBe(0)
    expect(calculateAggressionFactor(40, 30)).toBe(1)
  })

  it('returns 0.5 for invalid maxHealth', () => {
    expect(calculateAggressionFactor(10, 0)).toBe(0.5)
  })
})

describe('calculateClassPreference', () => {
  it('returns 50 for an empty hand', () => {
    expect(calculateClassPreference([], 'balanced')).toBe(50)
  })

  it('aggro personality prefers high-rank cards', () => {
    const high = calculateClassPreference([S('A'), H('K'), D('Q')], 'aggro')
    const low = calculateClassPreference([S('2'), H('3'), D('4')], 'aggro')
    expect(high).toBeGreaterThan(low)
  })

  it('balanced personality returns 50', () => {
    const score = calculateClassPreference([S('A'), H('5'), D('9')], 'balanced')
    expect(score).toBe(50)
  })
})

// ─── Tests: decideAction ──────────────────────────────────────────────

describe('decideAction', () => {
  describe('plays strong hands', () => {
    it('plays a pair of aces (balanced personality)', () => {
      const decision = decideAction(
        makeContext({
          hand: [S('A'), H('A'), D('5'), C('9'), S('Q')],
          personality: 'balanced',
        }),
      )
      expect(decision.playCards.length).toBeGreaterThan(0)
    })

    it('plays a flush (aggro personality)', () => {
      const decision = decideAction(
        makeContext({
          hand: [S('2'), S('5'), S('9'), S('J'), S('Q')],
          personality: 'aggro',
        }),
      )
      expect(decision.playCards.length).toBeGreaterThan(0)
    })

    it('plays a full house (defensive personality)', () => {
      const decision = decideAction(
        makeContext({
          hand: [S('K'), H('K'), D('K'), C('4'), S('4')],
          personality: 'defensive',
        }),
      )
      expect(decision.playCards.length).toBeGreaterThan(0)
    })
  })

  describe('discards weak cards', () => {
    it('discards weak cards from a low-value hand', () => {
      const decision = decideAction(
        makeContext({
          hand: [S('2'), H('4'), D('7'), C('9'), S('J')],
          personality: 'balanced',
        }),
      )
      // High-card hand with low values should trigger discards
      expect(decision.discardCards.length).toBeGreaterThan(0)
    })

    it('discards cards when hand exceeds maximum size', () => {
      const decision = decideAction(
        makeContext({
          hand: [
            S('2'), H('3'), D('4'), C('5'), S('6'),
            H('7'), D('8'), C('9'), S('10'),
          ],
          personality: 'balanced',
        }),
      )
      // At 9 cards — should discard at least 2 to get to max handsize
      expect(decision.discardCards.length).toBeGreaterThanOrEqual(2)
    })

    it('does not discard when all cards are strong', () => {
      const decision = decideAction(
        makeContext({
          hand: [S('A'), S('K'), S('Q'), S('J'), S('10')],
          personality: 'balanced',
        }),
      )
      // Royal flush — all cards should be played, none discarded
      expect(decision.discardCards.length).toBe(0)
    })
  })

  describe('uses ability when mana available', () => {
    it('uses ability with sufficient mana (aggro)', () => {
      const decision = decideAction(
        makeContext({
          hand: [S('A'), H('A'), D('5'), C('9'), S('Q')],
          mana: 8,
          maxMana: 10,
          personality: 'aggro',
        }),
      )
      expect(decision.useAbility).toBe(true)
    })

    it('does not use ability with zero mana', () => {
      const decision = decideAction(
        makeContext({
          hand: [S('A'), H('A'), D('5'), C('9'), S('Q')],
          mana: 0,
          maxMana: 10,
          personality: 'aggro',
        }),
      )
      expect(decision.useAbility).toBe(false)
    })

    it('does not use ability with very low mana for defensive personality', () => {
      const decision = decideAction(
        makeContext({
          hand: [S('A'), H('A'), D('5'), C('9'), S('Q')],
          mana: 1,
          maxMana: 10,
          personality: 'defensive',
        }),
      )
      // Defensive needs manaRatio >= 0.7, so 1/10 = 0.1 is too low
      expect(decision.useAbility).toBe(false)
    })

    it('does not use ability when HP is critically low', () => {
      const decision = decideAction(
        makeContext({
          hand: [S('A'), H('A'), D('5'), C('9'), S('Q')],
          health: 1,
          maxHealth: 30,
          mana: 5,
          maxMana: 10,
          personality: 'balanced',
        }),
      )
      // aggressionFactor = 1/30 = 0.033, which is < 0.3
      expect(decision.useAbility).toBe(false)
    })
  })

  describe('personality influences decisions', () => {
    it('aggro plays more aggressively (lower threshold)', () => {
      const moderateHand: readonly Card[] = [
        S('J'), H('10'), D('9'), C('8'), S('3'),
      ]

      const aggroDecision = decideAction(
        makeContext({ hand: moderateHand, personality: 'aggro' }),
      )
      const defensiveDecision = decideAction(
        makeContext({ hand: moderateHand, personality: 'defensive' }),
      )

      // Aggro should play cards that defensive would not
      expect(aggroDecision.playCards.length).toBeGreaterThanOrEqual(
        defensiveDecision.playCards.length,
      )
    })

    it('defensive prefers to discard weak cards more aggressively', () => {
      const weakHand: readonly Card[] = [
        S('2'), H('3'), D('5'), C('7'), S('9'),
      ]

      const decision = decideAction(
        makeContext({ hand: weakHand, personality: 'defensive' }),
      )
      // Very weak hand — defensive should discard some cards
      expect(decision.discardCards.length).toBeGreaterThan(0)
    })
  })

  describe('edge cases', () => {
    it('handles empty hand gracefully', () => {
      const decision = decideAction(
        makeContext({ hand: [], personality: 'balanced' }),
      )
      expect(decision.playCards).toEqual([])
      expect(decision.discardCards).toEqual([])
      expect(decision.useAbility).toBe(false)
    })

    it('handles single card hand', () => {
      const decision = decideAction(
        makeContext({ hand: [S('A')], personality: 'aggro' }),
      )
      // A single Ace should be worth playing for aggro
      expect(decision.playCards.length).toBeGreaterThan(0)
    })

    it('handles full health and max mana (maximum aggression)', () => {
      const decision = decideAction(
        makeContext({
          hand: [S('K'), H('K'), D('K'), C('K'), S('A')],
          health: 30,
          maxHealth: 30,
          mana: 10,
          maxMana: 10,
          personality: 'aggro',
        }),
      )
      // Four of a kind with full HP = play everything
      expect(decision.playCards.length).toBe(5)
      expect(decision.useAbility).toBe(true)
    })

    it('handles low health defensive posture', () => {
      const decision = decideAction(
        makeContext({
          hand: [S('2'), H('4'), D('7'), C('9'), S('J')],
          health: 3,
          maxHealth: 30,
          mana: 5,
          maxMana: 10,
          personality: 'defensive',
        }),
      )
      // Low HP + defensive = very conservative, may not play weak hand
      expect(decision.discardCards.length).toBeGreaterThan(0)
      expect(decision.useAbility).toBe(false)
    })
  })
})
