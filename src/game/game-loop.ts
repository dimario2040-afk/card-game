import type { Card } from '@/types'
import type { EntityState, GameState, TurnPhase } from '@/types/game'
import { decideAction, type AIContext, type AIDecision } from '@/ai/decision-engine'
import {
  calculateDamage,
  type AttackerModifiers,
  type DefenderStats,
} from './combat-engine'

// ---------------------------------------------------------------------------
// Phase state machine
// ---------------------------------------------------------------------------

/**
 * Phase transition map: DRAW → PLAYER_MAIN → DISCARD → ENEMY_TURN → RESOLVE → DRAW
 */
const PHASE_SEQUENCE: Readonly<Record<TurnPhase, TurnPhase>> = {
  idle: 'draw',
  draw: 'player_main',
  player_main: 'discard',
  discard: 'enemy_turn',
  enemy_turn: 'resolve',
  resolve: 'draw',
}

/** Advance to the next turn phase following the fixed cycle. */
export function advanceTurnPhase(current: TurnPhase): TurnPhase {
  return PHASE_SEQUENCE[current]
}

/** Returns `true` for phases that execute automatically without player input. */
export function isAutoPhase(phase: TurnPhase): boolean {
  return phase === 'draw' || phase === 'discard' || phase === 'enemy_turn' || phase === 'resolve'
}

/** Returns `true` for phases waiting on the player. */
export function isPlayerInputPhase(phase: TurnPhase): boolean {
  return phase === 'player_main'
}

// ---------------------------------------------------------------------------
// Draw Phase
// ---------------------------------------------------------------------------

export interface DrawPlan {
  readonly playerDrawCount: number
  readonly enemyDrawCount: number
  readonly logMessages: readonly string[]
}

const FIRST_TURN_DRAW = 2
const REGULAR_DRAW = 1
const ENEMY_DRAW = 1

/**
 * Determines how many cards each side draws at the start of the turn.
 * Player draws 2 on turn 1 (opening hand supplement), 1 thereafter.
 * Enemy always draws 1.
 */
export function planDrawPhase(
  _player: EntityState,
  _enemy: EntityState,
  turnNumber: number,
): DrawPlan {
  const playerDrawCount = turnNumber <= 1 ? FIRST_TURN_DRAW : REGULAR_DRAW
  const enemyDrawCount = ENEMY_DRAW

  const logMessages: string[] = []
  if (playerDrawCount > 0) {
    logMessages.push(`Player draws ${playerDrawCount} card(s).`)
  }
  if (enemyDrawCount > 0) {
    logMessages.push(`Enemy draws ${enemyDrawCount} card(s).`)
  }

  return { playerDrawCount, enemyDrawCount, logMessages }
}

// ---------------------------------------------------------------------------
// Discard Phase
// ---------------------------------------------------------------------------

export interface DiscardPlan {
  readonly playerExcess: number
  readonly enemyDiscardIds: readonly string[]
  readonly logMessages: readonly string[]
}

const MAX_HAND_SIZE = 7
const MIN_HAND_SIZE = 0

/**
 * During the discard phase, entities must reduce their hand to MAX_HAND_SIZE.
 * Player excess is reported back so the UI can prompt.
 * Enemy discards are calculated by the AI decision engine.
 */
export function planDiscardPhase(
  player: EntityState,
  enemy: EntityState,
): DiscardPlan {
  const playerExcess = Math.max(MIN_HAND_SIZE, player.hand.length - MAX_HAND_SIZE)
  const enemyExcess = Math.max(MIN_HAND_SIZE, enemy.hand.length - MAX_HAND_SIZE)

  const logMessages: string[] = []
  if (playerExcess > 0) {
    logMessages.push(`Player must discard ${playerExcess} card(s) (hand too large).`)
  }

  // AI decides which cards to discard from excess
  let enemyDiscardIds: readonly string[] = []
  if (enemyExcess > 0) {
    const ctx: AIContext = {
      hand: enemy.hand,
      health: enemy.health,
      maxHealth: enemy.maxHealth,
      mana: enemy.mana,
      maxMana: enemy.maxMana,
      personality: 'balanced',
    }
    const decision = decideAction(ctx)
    // Use discardCards from AI decision; if AI didn't pick any, discard weakest
    if (decision.discardCards.length > 0) {
      enemyDiscardIds = decision.discardCards.map((c: Card) => c.id).slice(0, enemyExcess)
    } else {
      // Fallback: discard lowest-ranked cards
      const sorted = [...enemy.hand].sort(
        (a, b) => RANK_SCORES[a.rank] - RANK_SCORES[b.rank],
      )
      enemyDiscardIds = sorted.slice(0, enemyExcess).map((c) => c.id)
    }
    logMessages.push(`Enemy discards ${enemyDiscardIds.length} card(s).`)
  }

  return { playerExcess, enemyDiscardIds, logMessages }
}

// ---------------------------------------------------------------------------
// Resolve Phase
// ---------------------------------------------------------------------------

export interface ResolvePlan {
  readonly logMessages: readonly string[]
}

/**
 * End-of-turn resolution: applies DoT effects, ticks down buff durations,
 * and prepares for the next turn.
 */
export function planResolvePhase(
  player: EntityState,
  enemy: EntityState,
): ResolvePlan {
  const messages: string[] = []

  // Tick burning DoT on enemy
  const burningTicks = enemy.buffs['burning']
  if (burningTicks !== undefined && burningTicks > 0) {
    const dotDamage = 2
    messages.push(`Burning deals ${dotDamage} damage to enemy.`)
    // Mark for ticking — actual state mutation is handled by the caller
    messages.push(`Burning duration decreases.`)
  }

  // Tick burning DoT on player
  const playerBurningTicks = player.buffs['burning']
  if (playerBurningTicks !== undefined && playerBurningTicks > 0) {
    const dotDamage = 2
    messages.push(`Burning deals ${dotDamage} damage to player.`)
  }

  messages.push('Turn resolution complete.')
  return { logMessages: messages }
}

// ---------------------------------------------------------------------------
// Enemy Turn (AI)
// ---------------------------------------------------------------------------

export interface EnemyTimedStep {
  readonly type: 'play_card' | 'damage' | 'discard_card' | 'use_ability' | 'log'
  readonly label: string
  readonly delayMs: number
  readonly payload: unknown
}

export interface EnemyTurnPlan {
  readonly steps: readonly EnemyTimedStep[]
  readonly logMessages: readonly string[]
}

const AI_DELAY_MIN = 800
const AI_DELAY_MAX = 1200
const AI_DAMAGE_DELAY_MIN = 600
const AI_DAMAGE_DELAY_MAX = 1000

/** Returns a random delay in the configured range. */
function randomDelay(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min))
}

/**
 * Maps a rank string to a score for sorting (higher = stronger).
 * Used only as a fallback sort key — not exposed publicly.
 */
const RANK_SCORES: Readonly<Record<string, number>> = {
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
}

/**
 * Plans the enemy's entire turn step-by-step.
 *
 * 1. Calls AI.decide() with enemy context to get play/discard/ability decisions.
 * 2. Converts the decision into timed animation steps (800–1200ms apart).
 * 3. Calculates damage via combat-engine for the played hand.
 *
 * Each step carries a `delayMs` for the React scheduler to animate sequentially.
 */
export function planEnemyTurn(
  enemy: EntityState,
  player: EntityState,
  _turnNumber: number,
): EnemyTurnPlan {
  const ctx: AIContext = {
    hand: enemy.hand,
    health: enemy.health,
    maxHealth: enemy.maxHealth,
    mana: enemy.mana,
    maxMana: enemy.maxMana,
    personality: 'balanced',
  }

  const decision: AIDecision = decideAction(ctx)
  const steps: EnemyTimedStep[] = []
  const logMessages: string[] = []

  // ── Step 1: Play cards (with animation delay) ──────────────────────
  if (decision.playCards.length > 0) {
    const playDelay = randomDelay(AI_DELAY_MIN, AI_DELAY_MAX)
    const playedCardIds = decision.playCards.map((c: Card) => c.id)
    steps.push({
      type: 'play_card',
      label: `Enemy plays ${decision.playCards.length} card(s)`,
      delayMs: playDelay,
      payload: playedCardIds,
    })
    logMessages.push(`Enemy plays ${decision.playCards.length} card(s).`)

    // ── Step 2: Calculate and deal damage ──────────────────────────
    const attackerMods: AttackerModifiers = {
      classAbility: 'none',
      classMultiplier: 1,
      relicMultiplier: 1,
      bonusDamage: 0,
      buffs: enemy.buffs,
    }

    const defenderStats: DefenderStats = {
      shield: player.shield,
      buffs: player.buffs,
    }

    const damageResult = calculateDamage(
      decision.playCards,
      attackerMods,
      defenderStats,
    )

    const damageDelay = randomDelay(AI_DAMAGE_DELAY_MIN, AI_DAMAGE_DELAY_MAX)
    steps.push({
      type: 'damage',
      label: `Enemy deals ${damageResult.totalDamage} damage`,
      delayMs: damageDelay,
      payload: { amount: damageResult.totalDamage, breakdown: damageResult.breakdown },
    })
    logMessages.push(
      `Enemy deals ${damageResult.totalDamage} damage ` +
      `(${damageResult.breakdown.rawDamage} raw after modifiers).`,
    )
  }

  // ── Step 3: Use class ability ────────────────────────────────────
  if (decision.useAbility) {
    const abilityDelay = randomDelay(AI_DELAY_MIN, AI_DELAY_MAX)
    steps.push({
      type: 'use_ability',
      label: 'Enemy uses class ability',
      delayMs: abilityDelay,
      payload: null,
    })
    logMessages.push('Enemy activates class ability.')
  }

  // ── Step 4: Discard cards ────────────────────────────────────────
  if (decision.discardCards.length > 0) {
    const discardDelay = randomDelay(AI_DELAY_MIN, AI_DELAY_MAX)
    const discardIds = decision.discardCards.map((c: Card) => c.id)
    steps.push({
      type: 'discard_card',
      label: `Enemy discards ${decision.discardCards.length} card(s)`,
      delayMs: discardDelay,
      payload: discardIds,
    })
    logMessages.push(`Enemy discards ${decision.discardCards.length} card(s).`)
  }

  // ── Edge: Enemy does nothing ─────────────────────────────────────
  if (steps.length === 0) {
    const passDelay = randomDelay(AI_DELAY_MIN, AI_DELAY_MAX)
    steps.push({
      type: 'log',
      label: 'Enemy passes',
      delayMs: passDelay,
      payload: null,
    })
    logMessages.push('Enemy passes their turn.')
  }

  return { steps, logMessages }
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Union of all possible phase plans.
 * Each auto-phase returns a specific plan; `player_main` and `idle` return null.
 */
export type PhasePlan =
  | DrawPlan
  | DiscardPlan
  | EnemyTurnPlan
  | ResolvePlan
  | null

/**
 * Main entry point: given the current game state, plans execution for the
 * active turn phase.
 *
 * - Auto-phases (draw, discard, enemy_turn, resolve) return a typed plan.
 * - Player interaction phases (player_main) and idle return `null`.
 *
 * The returned plan is consumed by a React hook that dispatches store actions
 * and manages animation timing.
 */
export function planPhase(state: GameState): PhasePlan {
  switch (state.turnPhase) {
    case 'draw':
      return planDrawPhase(state.player, state.enemy, state.turn)
    case 'discard':
      return planDiscardPhase(state.player, state.enemy)
    case 'enemy_turn':
      return planEnemyTurn(state.enemy, state.player, state.turn)
    case 'resolve':
      return planResolvePhase(state.player, state.enemy)
    case 'player_main':
    case 'idle':
      return null
  }
}
