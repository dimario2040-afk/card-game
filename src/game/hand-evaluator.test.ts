import { describe, it, expect } from 'vitest'
import type { Card } from '@/types'
import { HandType, findBestHand, evaluate5, HAND_TYPE_NAMES } from './hand-evaluator'

// ─── Fixture builders ───────────────────────────────────────────────

function card(id: string, suit: string, rank: string): Card {
  return { id, suit, rank }
}

const S = (rank: string) => card(`s${rank}`, 'spades', rank)
const H = (rank: string) => card(`h${rank}`, 'hearts', rank)
const D = (rank: string) => card(`d${rank}`, 'diamonds', rank)
const C = (rank: string) => card(`c${rank}`, 'clubs', rank)

// ─── Helpers ────────────────────────────────────────────────────────

function expectHand(
  cards: readonly Card[],
  expectedType: HandType,
  description: string,
): void {
  const result = findBestHand(cards)
  expect(result.handType, `${description}: expected ${HAND_TYPE_NAMES[expectedType]}, got ${HAND_TYPE_NAMES[result.handType]}`).toBe(expectedType)
}

function expectScore(cards: readonly Card[]): number {
  return findBestHand(cards).score
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('findBestHand', () => {
  describe('hand type detection', () => {
    it('detects high card when no other hand is made', () => {
      expectHand(
        [S('2'), H('5'), D('9'), C('J'), S('Q'), H('3'), D('7')],
        HandType.HIGH_CARD,
        'high card with 7 cards',
      )
    })

    it('detects one pair', () => {
      expectHand(
        [S('2'), H('5'), D('9'), C('9'), S('Q'), H('3'), D('7')],
        HandType.ONE_PAIR,
        'pair of 9s',
      )
    })

    it('detects two pair', () => {
      expectHand(
        [S('2'), H('5'), D('5'), C('9'), S('9'), H('3'), D('7')],
        HandType.TWO_PAIR,
        '9s and 5s',
      )
    })

    it('detects three of a kind', () => {
      expectHand(
        [S('2'), H('5'), D('9'), C('9'), S('9'), H('3'), D('7')],
        HandType.THREE_OF_A_KIND,
        'three 9s',
      )
    })

    it('detects straight', () => {
      expectHand(
        [S('2'), H('3'), D('4'), C('5'), S('6'), H('8'), D('K')],
        HandType.STRAIGHT,
        '2-6 straight',
      )
    })

    it('detects ace-low straight (A-2-3-4-5)', () => {
      expectHand(
        [S('A'), H('2'), D('3'), C('4'), S('5'), H('9'), D('K')],
        HandType.STRAIGHT,
        'ace-low straight 5-high',
      )
    })

    it('detects flush', () => {
      expectHand(
        [S('2'), S('5'), S('9'), S('J'), S('Q'), H('3'), D('7')],
        HandType.FLUSH,
        'spade flush Q-9-5-2',
      )
    })

    it('detects full house', () => {
      expectHand(
        [S('K'), H('K'), D('K'), C('4'), S('4'), H('9'), D('7')],
        HandType.FULL_HOUSE,
        'kings full of 4s',
      )
    })

    it('detects four of a kind', () => {
      expectHand(
        [S('10'), H('10'), D('10'), C('10'), S('Q'), H('3'), D('7')],
        HandType.FOUR_OF_A_KIND,
        'four 10s',
      )
    })

    it('detects straight flush', () => {
      expectHand(
        [S('5'), S('6'), S('7'), S('8'), S('9'), H('3'), D('K')],
        HandType.STRAIGHT_FLUSH,
        '9-high straight flush',
      )
    })

    it('detects royal flush', () => {
      expectHand(
        [D('10'), D('J'), D('Q'), D('K'), D('A'), H('3'), C('2')],
        HandType.ROYAL_FLUSH,
        'diamond royal flush',
      )
    })
  })

  describe('hand ranking and tiebreakers', () => {
    it('higher hand type always beats lower hand type', () => {
      const pair = expectScore([S('2'), H('2'), D('5'), C('9'), S('Q')])
      const highCard = expectScore([S('2'), H('5'), D('9'), C('J'), S('Q')])
      expect(pair).toBeGreaterThan(highCard)
    })

    it('higher pair beats lower pair', () => {
      const high = expectScore([S('A'), H('A'), D('5'), C('9'), S('Q')])
      const low = expectScore([S('K'), H('K'), D('5'), C('9'), S('Q')])
      expect(high).toBeGreaterThan(low)
    })

    it('higher kicker breaks same-pair tie', () => {
      const highKicker = expectScore([S('2'), H('2'), D('A'), C('K'), S('Q')])
      const lowKicker = expectScore([S('2'), H('2'), D('K'), C('Q'), S('J')])
      expect(highKicker).toBeGreaterThan(lowKicker)
    })

    it('higher two pair beats lower two pair', () => {
      const high = expectScore([S('A'), H('A'), D('K'), C('K'), S('Q')])
      const low = expectScore([S('A'), H('A'), D('Q'), C('Q'), S('J')])
      expect(high).toBeGreaterThan(low)
    })

    it('higher trips beat lower trips', () => {
      const high = expectScore([S('Q'), H('Q'), D('Q'), C('5'), S('3')])
      const low = expectScore([S('J'), H('J'), D('J'), C('A'), S('K')])
      expect(high).toBeGreaterThan(low)
    })

    it('higher full house beats lower full house by trips', () => {
      const high = expectScore([S('A'), H('A'), D('A'), C('3'), S('3')])
      const low = expectScore([S('K'), H('K'), D('K'), C('A'), S('A')])
      expect(high).toBeGreaterThan(low)
    })
  })

  describe('best hand selection from many cards', () => {
    it('chooses royal flush over straight flush when both available', () => {
      // Royal flush: 10-J-Q-K-A of spades
      // Straight flush: 6-7-8-9-10 of hearts
      const result = findBestHand([
        S('10'), S('J'), S('Q'), S('K'), S('A'),
        H('6'), H('7'), H('8'), H('9'), H('10'),
      ])
      expect(result.handType).toBe(HandType.ROYAL_FLUSH)
    })

    it('picks best 5 from 7 cards (select flush over straight)', () => {
      // 5 spades for a flush, but also a possible straight among non-spades
      const result = findBestHand([
        S('2'), S('4'), S('6'), S('8'), S('10'),
        H('3'), D('5'),
      ])
      // Flush (5) beats straight (4), but this isn't a straight anyway
      expect(result.handType).toBe(HandType.FLUSH)
    })

    it('selects best 5 from 7 where straight flush is hidden', () => {
      // 3-4-5-6-7 of hearts is a straight flush, plus unrelated cards
      const result = findBestHand([
        H('3'), H('4'), H('5'), H('6'), H('7'),
        S('K'), D('A'),
      ])
      expect(result.handType).toBe(HandType.STRAIGHT_FLUSH)
    })

    it('picks higher-ranked 5-card combination from 8 cards', () => {
      // A pair of Aces plus a pair of Kings = two pair, should find it
      // (no straight possible with disconnected ranks)
      const result = findBestHand([
        S('A'), H('A'), S('K'), H('K'), S('2'), H('3'), D('7'), C('9'),
      ])
      expect(result.handType).toBe(HandType.TWO_PAIR)
    })
  })

  describe('edge cases', () => {
    it('returns high card evaluation for fewer than 5 cards', () => {
      const result = findBestHand([S('2'), H('3'), D('4')])
      expect(result.handType).toBe(HandType.HIGH_CARD)
    })

    it('works with exactly 5 cards', () => {
      const result = findBestHand([S('A'), S('K'), S('Q'), S('J'), S('10')])
      expect(result.handType).toBe(HandType.ROYAL_FLUSH)
    })

    it('ace-low straight is 5-high (not ace-high)', () => {
      const aceLow = findBestHand([S('A'), H('2'), D('3'), C('4'), S('5'), H('9'), D('K')])
      const normalStraight = findBestHand([S('2'), H('3'), D('4'), C('5'), S('6'), H('9'), D('K')])
      // 5-high straight (ace-low) is weaker than 6-high straight
      expect(aceLow.score).toBeLessThan(normalStraight.score)
    })

    it('straight flush ace-low (A-2-3-4-5 same suit)', () => {
      // Ace-low straight flush in spades
      const result = findBestHand([
        S('A'), S('2'), S('3'), S('4'), S('5'), H('9'), D('K'),
      ])
      expect(result.handType).toBe(HandType.STRAIGHT_FLUSH)
    })

    it('four of a kind with ace kicker beats four of a kind with king kicker', () => {
      const ace = findBestHand([S('9'), H('9'), D('9'), C('9'), S('A')])
      const king = findBestHand([S('9'), H('9'), D('9'), C('9'), S('K')])
      expect(ace.score).toBeGreaterThan(king.score)
    })

    it('flush tiebroken by highest card', () => {
      const high = findBestHand([S('A'), S('K'), S('Q'), S('J'), S('9')])
      const low = findBestHand([S('A'), S('K'), S('Q'), S('J'), S('8')])
      expect(high.score).toBeGreaterThan(low.score)
    })

    it('full house tiebroken by trips then pair', () => {
      const high = findBestHand([S('A'), H('A'), D('A'), C('K'), S('K')])
      const low = findBestHand([S('A'), H('A'), D('A'), C('Q'), S('Q')])
      expect(high.score).toBeGreaterThan(low.score)
    })
  })

  describe('evaluate5 standalone', () => {
    it('scores a royal flush correctly', () => {
      const r = evaluate5([S('A'), S('K'), S('Q'), S('J'), S('10')])
      expect(r.handType).toBe(HandType.ROYAL_FLUSH)
    })

    it('scores a high card correctly', () => {
      const r = evaluate5([S('2'), H('4'), D('7'), C('9'), S('J')])
      expect(r.handType).toBe(HandType.HIGH_CARD)
    })
  })
})
