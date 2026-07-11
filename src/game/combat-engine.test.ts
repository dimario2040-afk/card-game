import { describe, it, expect } from 'vitest'
import type { Card } from '@/types'
import { HandType } from './hand-evaluator'
import {
  calculateDamage,
  type AttackerModifiers,
  type DefenderStats,
} from './combat-engine'

// ─── Fixture builders ───────────────────────────────────────────────

function card(id: string, suit: string, rank: string): Card {
  return { id, suit, rank }
}

const S = (rank: string) => card(`s${rank}`, 'spades', rank)
const H = (rank: string) => card(`h${rank}`, 'hearts', rank)
const D = (rank: string) => card(`d${rank}`, 'diamonds', rank)
const C = (rank: string) => card(`c${rank}`, 'clubs', rank)

// ─── Default modifiers ──────────────────────────────────────────────

const defaultAttacker: AttackerModifiers = {
  classAbility: 'none',
  classMultiplier: 1,
  relicMultiplier: 1,
  bonusDamage: 0,
  buffs: {},
}

const defaultDefender: DefenderStats = {
  shield: 0,
  buffs: {},
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('calculateDamage', () => {
  describe('damage formula: baseChips * baseMult * classMult * relicMult - shield', () => {
    it('calculates high card damage correctly from chip values and base mult', () => {
      // High card: A♠ K♠ Q♠ J♠ 9♠ (all spades but not flush straight — wait, it IS a flush)
      // Actually: give a non-flush high card: 2♠ 5♥ 9♦ J♣ A♠
      const hand = [S('2'), H('5'), D('9'), C('J'), S('A')]
      const result = calculateDamage(hand, defaultAttacker, defaultDefender)

      // best hand = HIGH_CARD with A,J,9,5,2 => baseMult=1
      // chips = 11(A) + 10(J) + 9(9) + 5(5) + 2(2) = 37
      // raw = 37 * 1 = 37
      expect(result.breakdown.baseChips).toBe(37)
      expect(result.breakdown.baseMult).toBe(1)
      expect(result.breakdown.rawDamage).toBe(37)
      expect(result.breakdown.handType).toBe(HandType.HIGH_CARD)
    })

    it('calculates one pair damage with pair mult bonus', () => {
      // One pair: 9♠ 9♥ A♦ K♣ Q♠
      const hand = [S('9'), H('9'), D('A'), C('K'), S('Q')]
      const result = calculateDamage(hand, defaultAttacker, defaultDefender)

      // Chips: 9+9+11+10+10 = 49
      // Base mult for ONE_PAIR = 2
      // raw = 49 * 2 = 98
      expect(result.breakdown.handType).toBe(HandType.ONE_PAIR)
      expect(result.breakdown.baseChips).toBe(49)
      expect(result.breakdown.baseMult).toBe(2)
      expect(result.breakdown.rawDamage).toBe(98)
    })

    it('applies classMultiplier to raw damage', () => {
      const hand = [S('2'), H('5'), D('9'), C('J'), S('A')]
      const attacker: AttackerModifiers = {
        ...defaultAttacker,
        classMultiplier: 1.5,
      }
      const result = calculateDamage(hand, attacker, defaultDefender)

      // raw = 37, classMulti = 1.5 => 55.5
      expect(result.breakdown.classMultiplier).toBe(1.5)
      expect(result.breakdown.rawDamage).toBe(37)
      expect(result.breakdown.totalBeforeShield).toBe(55.5)
    })

    it('applies relicMultiplier multiplicatively after classMultiplier', () => {
      const hand = [S('2'), H('5'), D('9'), C('J'), S('A')]
      const attacker: AttackerModifiers = {
        ...defaultAttacker,
        classMultiplier: 1.5,
        relicMultiplier: 2,
      }
      const result = calculateDamage(hand, attacker, defaultDefender)

      // raw = 37, classMult = 1.5 => 55.5, relicMult = 2 => 111
      expect(result.breakdown.relicMultiplier).toBe(2)
      expect(result.breakdown.totalBeforeShield).toBe(111)
    })

    it('adds flat bonusDamage to total before shield', () => {
      const hand = [S('2'), H('5'), D('9'), C('J'), S('A')]
      const attacker: AttackerModifiers = {
        ...defaultAttacker,
        bonusDamage: 10,
      }
      const result = calculateDamage(hand, attacker, defaultDefender)

      // raw = 37, bonus = 10 => 47
      expect(result.breakdown.totalBeforeShield).toBe(47)
    })

    it('royal flush produces highest raw damage', () => {
      // Royal flush: A♠ K♠ Q♠ J♠ 10♠
      const hand = [S('A'), S('K'), S('Q'), S('J'), S('10')]
      const result = calculateDamage(hand, defaultAttacker, defaultDefender)

      // Chips: 11+10+10+10+10 = 51
      // Base mult for ROYAL_FLUSH = 10
      // raw = 51 * 10 = 510
      expect(result.breakdown.handType).toBe(HandType.ROYAL_FLUSH)
      expect(result.breakdown.rawDamage).toBe(510)
      expect(result.breakdown.totalDamage).toBe(510)
    })
  })

  describe('shield absorption', () => {
    it('subtracts shield from total damage before applying to health', () => {
      const hand = [S('2'), H('5'), D('9'), C('J'), S('A')]
      const defender: DefenderStats = { shield: 10, buffs: {} }
      const result = calculateDamage(hand, defaultAttacker, defender)

      // raw = 37, shield = 10 => healthDamage = 27
      expect(result.breakdown.shieldAbsorbed).toBe(10)
      expect(result.breakdown.shieldRemaining).toBe(0)
      expect(result.breakdown.healthDamage).toBe(27)
    })

    it('fully absorbs damage when shield >= total damage', () => {
      const hand = [S('2'), H('5'), D('9'), C('J'), S('A')]
      const defender: DefenderStats = { shield: 100, buffs: {} }
      const result = calculateDamage(hand, defaultAttacker, defender)

      // raw = 37, shield = 100 => healthDamage = 0
      expect(result.breakdown.shieldAbsorbed).toBe(37)
      expect(result.breakdown.shieldRemaining).toBe(63)
      expect(result.breakdown.healthDamage).toBe(0)
      expect(result.totalDamage).toBe(0)
    })

    it('partially absorbs damage when shield < total damage', () => {
      const hand = [S('2'), H('5'), D('9'), C('J'), S('A')]
      const defender: DefenderStats = { shield: 15, buffs: {} }
      const result = calculateDamage(hand, defaultAttacker, defender)

      // raw = 37, shield = 15 => healthDamage = 22
      expect(result.breakdown.shieldAbsorbed).toBe(15)
      expect(result.breakdown.shieldRemaining).toBe(0)
      expect(result.breakdown.healthDamage).toBe(22)
    })

    it('deals zero damage when shield exceeds damage after multipliers', () => {
      const hand = [S('2'), H('5'), D('9'), C('J'), S('A')]
      const attacker: AttackerModifiers = {
        ...defaultAttacker,
        classMultiplier: 0.5,
      }
      const defender: DefenderStats = { shield: 30, buffs: {} }
      const result = calculateDamage(hand, attacker, defender)

      // raw = 37, classMult = 0.5 => 18.5, shield = 30 => 0 health damage
      expect(result.breakdown.healthDamage).toBe(0)
      expect(result.breakdown.shieldAbsorbed).toBe(18.5)
    })
  })

  describe('class ability modifiers', () => {
    describe('Chain Lightning', () => {
      it('adds +3 damage per spade card in hand', () => {
        // 3 spades in hand
        const hand = [S('2'), S('5'), S('9'), H('J'), D('A')]
        const attacker: AttackerModifiers = {
          ...defaultAttacker,
          classAbility: 'chain_lightning',
        }
        const result = calculateDamage(hand, attacker, defaultDefender)

        // 3 spades * 3 = 9 bonus
        expect(result.breakdown.abilityBonus).toBe(9)
      })

      it('adds no bonus when no spades in hand', () => {
        const hand = [H('2'), H('5'), D('9'), C('J'), D('A')]
        const attacker: AttackerModifiers = {
          ...defaultAttacker,
          classAbility: 'chain_lightning',
        }
        const result = calculateDamage(hand, attacker, defaultDefender)

        expect(result.breakdown.abilityBonus).toBe(0)
      })

      it('adds +15 for all 5 spades', () => {
        const hand = [S('2'), S('5'), S('9'), S('J'), S('A')]
        const attacker: AttackerModifiers = {
          ...defaultAttacker,
          classAbility: 'chain_lightning',
        }
        const result = calculateDamage(hand, attacker, defaultDefender)

        expect(result.breakdown.abilityBonus).toBe(15)
      })
    })

    describe('Hell Fire', () => {
      it('adds +2 damage per face card (J/Q/K/A) in hand', () => {
        // A, J, Q, K are face cards = 4 face cards
        const hand = [S('A'), H('J'), D('Q'), C('K'), S('10')]
        const attacker: AttackerModifiers = {
          ...defaultAttacker,
          classAbility: 'hell_fire',
        }
        const result = calculateDamage(hand, attacker, defaultDefender)

        // 4 face cards * 2 = 8
        expect(result.breakdown.abilityBonus).toBe(8)
      })

      it('applies burning status effect when hell fire triggers', () => {
        const hand = [S('A'), H('J'), D('Q'), C('K'), S('10')]
        const attacker: AttackerModifiers = {
          ...defaultAttacker,
          classAbility: 'hell_fire',
        }
        const result = calculateDamage(hand, attacker, defaultDefender)

        const burning = result.breakdown.statusEffectsApplied.find(
          (e) => e.type === 'burning',
        )
        expect(burning).toBeDefined()
        expect(burning!.value).toBe(2)
        expect(burning!.duration).toBe(2)
      })

      it('adds no bonus when hand has no face cards', () => {
        const hand = [S('2'), H('5'), D('7'), C('8'), S('9')]
        const attacker: AttackerModifiers = {
          ...defaultAttacker,
          classAbility: 'hell_fire',
        }
        const result = calculateDamage(hand, attacker, defaultDefender)

        expect(result.breakdown.abilityBonus).toBe(0)
      })
    })

    describe('Shield Burst', () => {
      it('adds bonus damage equal to 2x defender shield', () => {
        const hand = [S('2'), H('5'), D('9'), C('J'), S('A')]
        const attacker: AttackerModifiers = {
          ...defaultAttacker,
          classAbility: 'shield_burst',
        }
        const defender: DefenderStats = { shield: 10, buffs: {} }
        const result = calculateDamage(hand, attacker, defender)

        // shield_burst bonus = 10 * 2 = 20
        expect(result.breakdown.abilityBonus).toBe(20)
      })

      it('adds no bonus when defender has zero shield', () => {
        const hand = [S('2'), H('5'), D('9'), C('J'), S('A')]
        const attacker: AttackerModifiers = {
          ...defaultAttacker,
          classAbility: 'shield_burst',
        }
        const result = calculateDamage(hand, attacker, defaultDefender)

        expect(result.breakdown.abilityBonus).toBe(0)
      })

      it('adds large bonus against high-shield defender', () => {
        const hand = [S('2'), H('5'), D('9'), C('J'), S('A')]
        const attacker: AttackerModifiers = {
          ...defaultAttacker,
          classAbility: 'shield_burst',
        }
        const defender: DefenderStats = { shield: 50, buffs: {} }
        const result = calculateDamage(hand, attacker, defender)

        expect(result.breakdown.abilityBonus).toBe(100)
      })

      it('applies shield_shatter status effect', () => {
        const hand = [S('2'), H('5'), D('9'), C('J'), S('A')]
        const attacker: AttackerModifiers = {
          ...defaultAttacker,
          classAbility: 'shield_burst',
        }
        const defender: DefenderStats = { shield: 10, buffs: {} }
        const result = calculateDamage(hand, attacker, defender)

        const shatter = result.breakdown.statusEffectsApplied.find(
          (e) => e.type === 'shield_shatter',
        )
        expect(shatter).toBeDefined()
        expect(shatter!.value).toBe(1)
      })
    })
  })

  describe('defender buffs', () => {
    it('vulnerable increases damage taken by 50% per stack', () => {
      const hand = [S('2'), H('5'), D('9'), C('J'), S('A')]
      const defender: DefenderStats = {
        shield: 0,
        buffs: { vulnerable: 1 },
      }
      const result = calculateDamage(hand, defaultAttacker, defender)

      // raw = 37, vulnerable(1) = *1.5 => 55.5 rounded = 56
      expect(result.totalDamage).toBe(56)
    })

    it('fortified reduces damage taken by 25% per stack', () => {
      const hand = [S('2'), H('5'), D('9'), C('J'), S('A')]
      const defender: DefenderStats = {
        shield: 0,
        buffs: { fortified: 1 },
      }
      const result = calculateDamage(hand, defaultAttacker, defender)

      // raw = 37, fortified(1) = *0.75 => 27.75 rounded = 28
      expect(result.totalDamage).toBe(28)
    })

    it('vulnerable and fortified stack multiplicatively', () => {
      const hand = [S('2'), H('5'), D('9'), C('J'), S('A')]
      const defender: DefenderStats = {
        shield: 0,
        buffs: { vulnerable: 1, fortified: 1 },
      }
      const result = calculateDamage(hand, defaultAttacker, defender)

      // raw = 37, vulnerable(1)=*1.5 => 55.5, fortified(1)=*0.75 => 41.625
      expect(result.totalDamage).toBe(42)
    })

    it('shield is absorbed before vulnerable/fortified modifiers', () => {
      const hand = [S('2'), H('5'), D('9'), C('J'), S('A')]
      const defender: DefenderStats = {
        shield: 10,
        buffs: { vulnerable: 1 },
      }
      const result = calculateDamage(hand, defaultAttacker, defender)

      // raw = 37, shield = 10 => healthDamage = 27
      // vulnerable(1) = *1.5 => 40.5 rounded = 41
      expect(result.breakdown.shieldAbsorbed).toBe(10)
      expect(result.totalDamage).toBe(41)
    })
  })
})
