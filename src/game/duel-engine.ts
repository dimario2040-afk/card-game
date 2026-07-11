
import type { Card } from "../types";
import type { DuelState, Unit } from "../types/game";
import { findBestHand } from "./hand-evaluator";

export interface DuelResult {
  readonly attackerDamage: number;
  readonly defenderDamage: number;
  readonly counterDamage: number;
  readonly discardedCards: Card[];
  readonly log: string;
}

export function resolveBet(duel: DuelState, action: 'fold' | 'call' | 'raise', amount?: number): DuelState {
  // Логика ставок (временно упрощена)
  return { ...duel, phase: 'combat' };
}

export function resolveHands(
  attacker: Unit,
  defender: Unit,
  attackerCards: Card[],
  defenderCards: Card[]
): DuelResult {
  const attScore = findBestHand(attackerCards).score + attacker.attack;
  const defScore = findBestHand(defenderCards).score + defender.attack;

  let attackerDamage = 0;
  let counterDamage = 0;

  if (attScore > defScore) {
    attackerDamage = Math.max(1, attScore - defScore);
  } else if (attScore < defScore) {
    // Атака отбита
  } else {
    attackerDamage = Math.max(0, attacker.attack - defender.attack);
  }

  // Ответный удар (черви/трефы в передней линии)
  if (attackerDamage > 0) {
      counterDamage = Math.max(1, defender.attack - attacker.attack);
  }

  return {
    attackerDamage,
    defenderDamage: 0,
    counterDamage,
    discardedCards: [...attackerCards, ...defenderCards],
    log: `Attacker scored ${attScore}, defender scored ${defScore}. Damage: ${attackerDamage}`
  };
}
