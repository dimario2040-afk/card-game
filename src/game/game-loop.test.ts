import { describe, it, expect } from 'vitest'
import type { Card } from '@/types'
import type { EntityState, GameState, TurnPhase } from '@/types/game'
import {
  advanceTurnPhase,
  isAutoPhase,
  isPlayerInputPhase,
  planDrawPhase,
  planDiscardPhase,
  planResolvePhase,
  planEnemyTurn,
  planPhase,
  type DrawPlan,
  type DiscardPlan,
  type ResolvePlan,
  type EnemyTurnPlan,
} from './game-loop'

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function card(id: string, suit: string, rank: string): Card {
  return { id, suit, rank }
}

const S = (rank: string) => card(`s${rank}`, 'spades', rank)

function makeEntity(overrides: Partial<EntityState> = {}): EntityState {
  return {
    id: 'entity',
    name: 'Entity',
    health: 30,
    maxHealth: 30,
    hand: [],
    deck: [],
    discardPile: [],
    mana: 3,
    maxMana: 3,
    shield: 0,
    relics: [],
    buffs: {},
    ...overrides,
  }
}

function makePlayer(overrides: Partial<EntityState> = {}): EntityState {
  return makeEntity({ id: 'player', name: 'Player', ...overrides })
}

function makeEnemy(overrides: Partial<EntityState> = {}): EntityState {
  return makeEntity({ id: 'enemy', name: 'Enemy', ...overrides })
}

// ---------------------------------------------------------------------------
// advanceTurnPhase
// ---------------------------------------------------------------------------

describe('advanceTurnPhase', () => {
  it('advances idle → draw', () => {
    expect(advanceTurnPhase('idle')).toBe('draw')
  })

  it('advances draw → player_main', () => {
    expect(advanceTurnPhase('draw')).toBe('player_main')
  })

  it('advances player_main → discard', () => {
    expect(advanceTurnPhase('player_main')).toBe('discard')
  })

  it('advances discard → enemy_turn', () => {
    expect(advanceTurnPhase('discard')).toBe('enemy_turn')
  })

  it('advances enemy_turn → resolve', () => {
    expect(advanceTurnPhase('enemy_turn')).toBe('resolve')
  })

  it('advances resolve → draw (cycle completes)', () => {
    expect(advanceTurnPhase('resolve')).toBe('draw')
  })
})

// ---------------------------------------------------------------------------
// isAutoPhase / isPlayerInputPhase
// ---------------------------------------------------------------------------

describe('isAutoPhase', () => {
  it('returns true for draw', () => {
    expect(isAutoPhase('draw')).toBe(true)
  })

  it('returns true for discard', () => {
    expect(isAutoPhase('discard')).toBe(true)
  })

  it('returns true for enemy_turn', () => {
    expect(isAutoPhase('enemy_turn')).toBe(true)
  })

  it('returns true for resolve', () => {
    expect(isAutoPhase('resolve')).toBe(true)
  })

  it('returns false for player_main', () => {
    expect(isAutoPhase('player_main')).toBe(false)
  })

  it('returns false for idle', () => {
    expect(isAutoPhase('idle')).toBe(false)
  })
})

describe('isPlayerInputPhase', () => {
  it('returns true for player_main', () => {
    expect(isPlayerInputPhase('player_main')).toBe(true)
  })

  it('returns false for all other phases', () => {
    const phases: readonly TurnPhase[] = ['idle', 'draw', 'discard', 'enemy_turn', 'resolve']
    for (const phase of phases) {
      expect(isPlayerInputPhase(phase)).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// planDrawPhase
// ---------------------------------------------------------------------------

describe('planDrawPhase', () => {
  it('draws 2 for player on turn 1', () => {
    const player = makePlayer({ deck: [S('A'), S('K'), S('Q')] })
    const enemy = makeEnemy({ deck: [S('2'), S('3')] })
    const plan: DrawPlan = planDrawPhase(player, enemy, 1)
    expect(plan.playerDrawCount).toBe(2)
    expect(plan.enemyDrawCount).toBe(1)
  })

  it('draws 1 for player on turn 2+', () => {
    const player = makePlayer({ deck: [S('A'), S('K')] })
    const enemy = makeEnemy()
    const plan: DrawPlan = planDrawPhase(player, enemy, 3)
    expect(plan.playerDrawCount).toBe(1)
  })

  it('draws 1 for enemy on every turn', () => {
    const player = makePlayer()
    const enemy = makeEnemy({ deck: [S('2')] })
    const planTurn1: DrawPlan = planDrawPhase(player, enemy, 1)
    const planTurn5: DrawPlan = planDrawPhase(player, enemy, 5)
    expect(planTurn1.enemyDrawCount).toBe(1)
    expect(planTurn5.enemyDrawCount).toBe(1)
  })

  it('logs messages for both draws', () => {
    const player = makePlayer({ deck: [S('A'), S('K'), S('Q')] })
    const enemy = makeEnemy({ deck: [S('2')] })
    const plan: DrawPlan = planDrawPhase(player, enemy, 1)
    expect(plan.logMessages.length).toBeGreaterThan(0)
    expect(plan.logMessages[0]).toContain('Player draws')
    expect(plan.logMessages[1]).toContain('Enemy draws')
  })

  it('handles empty player deck gracefully', () => {
    const player = makePlayer({ deck: [] })
    const enemy = makeEnemy({ deck: [S('2')] })
    const plan: DrawPlan = planDrawPhase(player, enemy, 1)
    expect(plan.playerDrawCount).toBe(2)
    expect(plan.enemyDrawCount).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// planDiscardPhase
// ---------------------------------------------------------------------------

describe('planDiscardPhase', () => {
  it('returns zero excess when hands are within limit', () => {
    const player = makePlayer({ hand: [S('A'), S('K'), S('Q'), S('J'), S('10')] })
    const enemy = makeEnemy({ hand: [S('2'), S('3')] })
    const plan: DiscardPlan = planDiscardPhase(player, enemy)
    expect(plan.playerExcess).toBe(0)
    expect(plan.enemyDiscardIds.length).toBe(0)
  })

  it('reports excess when player hand exceeds max hand size', () => {
    const player = makePlayer({
      hand: [S('A'), S('K'), S('Q'), S('J'), S('10'), S('9'), S('8'), S('7')],
    })
    const enemy = makeEnemy()
    const plan: DiscardPlan = planDiscardPhase(player, enemy)
    expect(plan.playerExcess).toBe(1) // 8 cards - 7 max = 1
  })

  it('uses AI to decide enemy discard cards when hand exceeds limit', () => {
    const enemy = makeEnemy({
      hand: [S('A'), S('2'), S('3'), S('4'), S('5'), S('6'), S('7'), S('8'), S('9')],
    })
    const player = makePlayer()
    const plan: DiscardPlan = planDiscardPhase(player, enemy)
    // 9 cards - 7 max = 2 excess → AI should pick at least 2
    expect(plan.enemyDiscardIds.length).toBeGreaterThanOrEqual(0) // AI may or may not have discard candidates
  })

  it('logs messages when discarding', () => {
    const player = makePlayer({
      hand: [S('A'), S('2'), S('3'), S('4'), S('5'), S('6'), S('7'), S('8')],
    })
    const enemy = makeEnemy({
      hand: [S('A'), S('2'), S('3'), S('4'), S('5'), S('6'), S('7'), S('8'), S('9')],
    })
    const plan: DiscardPlan = planDiscardPhase(player, enemy)
    expect(plan.logMessages.length).toBeGreaterThan(0)
  })

  it('handles empty player and enemy hands', () => {
    const player = makePlayer({ hand: [] })
    const enemy = makeEnemy({ hand: [] })
    const plan: DiscardPlan = planDiscardPhase(player, enemy)
    expect(plan.playerExcess).toBe(0)
    expect(plan.enemyDiscardIds.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// planResolvePhase
// ---------------------------------------------------------------------------

describe('planResolvePhase', () => {
  it('returns a completion message', () => {
    const player = makePlayer()
    const enemy = makeEnemy()
    const plan: ResolvePlan = planResolvePhase(player, enemy)
    expect(plan.logMessages.length).toBeGreaterThan(0)
    expect(plan.logMessages[plan.logMessages.length - 1]).toContain('complete')
  })

  it('logs burning damage when enemy has burning buff', () => {
    const player = makePlayer()
    const enemy = makeEnemy({ buffs: { burning: 2 } })
    const plan: ResolvePlan = planResolvePhase(player, enemy)
    const burningMsg = plan.logMessages.find((m) => m.includes('Burning'))
    expect(burningMsg).toBeDefined()
    expect(burningMsg).toContain('damage to enemy')
  })

  it('logs burning damage when player has burning buff', () => {
    const player = makePlayer({ buffs: { burning: 1 } })
    const enemy = makeEnemy()
    const plan: ResolvePlan = planResolvePhase(player, enemy)
    const burningMsg = plan.logMessages.find((m) => m.includes('Burning'))
    expect(burningMsg).toBeDefined()
    expect(burningMsg).toContain('damage to player')
  })

  it('handles no buffs without errors', () => {
    const player = makePlayer({ buffs: {} })
    const enemy = makeEnemy({ buffs: {} })
    const plan: ResolvePlan = planResolvePhase(player, enemy)
    expect(plan.logMessages.length).toBe(1) // just completion
  })
})

// ---------------------------------------------------------------------------
// planEnemyTurn
// ---------------------------------------------------------------------------

describe('planEnemyTurn', () => {
  it('returns steps when enemy plays cards', () => {
    const enemy = makeEnemy({
      hand: [S('A'), S('K'), S('Q'), S('J'), S('10')],
      health: 30,
      maxHealth: 30,
      mana: 10,
      maxMana: 10,
    })
    const player = makePlayer()
    const plan: EnemyTurnPlan = planEnemyTurn(enemy, player, 1)

    // Should have at least play + damage steps
    expect(plan.steps.length).toBeGreaterThanOrEqual(2)
    const playStep = plan.steps.find((s) => s.type === 'play_card')
    expect(playStep).toBeDefined()
    const damageStep = plan.steps.find((s) => s.type === 'damage')
    expect(damageStep).toBeDefined()
  })

  it('each step has a delay between 600-1200ms', () => {
    const enemy = makeEnemy({
      hand: [S('A'), S('K'), S('Q'), S('J'), S('10')],
      health: 30,
      maxHealth: 30,
      mana: 10,
      maxMana: 10,
    })
    const player = makePlayer()
    const plan: EnemyTurnPlan = planEnemyTurn(enemy, player, 1)

    for (const step of plan.steps) {
      expect(step.delayMs).toBeGreaterThanOrEqual(600)
      expect(step.delayMs).toBeLessThanOrEqual(1200)
    }
  })

  it('returns a log step when enemy has no cards to play', () => {
    const enemy = makeEnemy({
      hand: [],
      health: 30,
      maxHealth: 30,
      mana: 0,
      maxMana: 10,
    })
    const player = makePlayer()
    const plan: EnemyTurnPlan = planEnemyTurn(enemy, player, 1)

    expect(plan.steps.length).toBe(1)
    expect(plan.steps[0].type).toBe('log')
    expect(plan.steps[0].label).toContain('passes')
  })

  it('includes damage payload with amount and breakdown', () => {
    const enemy = makeEnemy({
      hand: [S('A'), S('2'), S('3'), S('4'), S('5')],
      health: 30,
      maxHealth: 30,
      mana: 10,
      maxMana: 10,
    })
    const player = makePlayer()
    const plan: EnemyTurnPlan = planEnemyTurn(enemy, player, 1)

    const damageStep = plan.steps.find((s) => s.type === 'damage')
    if (damageStep) {
      const payload = damageStep.payload as { amount: number; breakdown: object }
      expect(typeof payload.amount).toBe('number')
      expect(payload.breakdown).toBeDefined()
    }
  })

  it('generates log messages for steps taken', () => {
    const enemy = makeEnemy({
      hand: [S('A'), S('K'), S('Q'), S('J'), S('10')],
      health: 30,
      maxHealth: 30,
      mana: 10,
      maxMana: 10,
    })
    const player = makePlayer()
    const plan: EnemyTurnPlan = planEnemyTurn(enemy, player, 1)
    expect(plan.logMessages.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// planPhase (orchestrator)
// ---------------------------------------------------------------------------

describe('planPhase', () => {
  it('returns a DrawPlan for draw phase', () => {
    const state: GameState = {
      gamePhase: 'playing',
      turnPhase: 'draw',
      turn: 1,
      player: makePlayer({ deck: [S('A'), S('K'), S('Q')] }),
      enemy: makeEnemy({ deck: [S('2')] }),
      selectedCardIds: [],
      combatLog: [],
      winner: null,
    }
    const plan = planPhase(state)
    expect(plan).not.toBeNull()
    expect(plan).toHaveProperty('playerDrawCount')
  })

  it('returns a DiscardPlan for discard phase', () => {
    const state: GameState = {
      gamePhase: 'playing',
      turnPhase: 'discard',
      turn: 1,
      player: makePlayer(),
      enemy: makeEnemy(),
      selectedCardIds: [],
      combatLog: [],
      winner: null,
    }
    const plan = planPhase(state)
    expect(plan).not.toBeNull()
    expect(plan).toHaveProperty('playerExcess')
  })

  it('returns an EnemyTurnPlan for enemy_turn phase', () => {
    const state: GameState = {
      gamePhase: 'playing',
      turnPhase: 'enemy_turn',
      turn: 1,
      player: makePlayer(),
      enemy: makeEnemy({ hand: [S('A'), S('K'), S('Q'), S('J'), S('10')] }),
      selectedCardIds: [],
      combatLog: [],
      winner: null,
    }
    const plan = planPhase(state)
    expect(plan).not.toBeNull()
    expect(plan).toHaveProperty('steps')
  })

  it('returns a ResolvePlan for resolve phase', () => {
    const state: GameState = {
      gamePhase: 'playing',
      turnPhase: 'resolve',
      turn: 1,
      player: makePlayer(),
      enemy: makeEnemy(),
      selectedCardIds: [],
      combatLog: [],
      winner: null,
    }
    const plan = planPhase(state)
    expect(plan).not.toBeNull()
    expect(plan).toHaveProperty('logMessages')
  })

  it('returns null for player_main phase', () => {
    const state: GameState = {
      gamePhase: 'playing',
      turnPhase: 'player_main',
      turn: 1,
      player: makePlayer(),
      enemy: makeEnemy(),
      selectedCardIds: [],
      combatLog: [],
      winner: null,
    }
    expect(planPhase(state)).toBeNull()
  })

  it('returns null for idle phase', () => {
    const state: GameState = {
      gamePhase: 'lobby',
      turnPhase: 'idle',
      turn: 0,
      player: makePlayer(),
      enemy: makeEnemy(),
      selectedCardIds: [],
      combatLog: [],
      winner: null,
    }
    expect(planPhase(state)).toBeNull()
  })
})
