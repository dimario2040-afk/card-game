
import type { Card, Suit } from "../types";
import type { Unit, DuelState } from "../types/game";

const SUIT_RANK: Record<Suit, number> = {
  hearts: 4,
  diamonds: 3,
  clubs: 2,
  spades: 1,
};

export type ActionType = 'move' | 'attack' | 'spell' | 'pass';

export interface BattleResult {
  readonly log: string;
  readonly updatedUnit: Unit;
}

export function calculateInitiative(playerField: readonly (Unit | null)[][], enemyField: readonly (Unit | null)[][]): Unit[] {
  const allUnits: Unit[] = [...playerField.flat(), ...enemyField.flat()].filter((u): u is Unit => u !== null);
  
  return allUnits.sort((a, b) => {
    if (a.spd !== b.spd) return b.spd - a.spd;
    return 0;
  });
}

export function drawToHandSize(hand: readonly Card[], deck: readonly Card[], targetSize = 5): { newHand: Card[], newDeck: Card[] } {
  const diff = targetSize - hand.length;
  if (diff <= 0) return { newHand: [...hand], newDeck: [...deck] };

  const drawn = deck.slice(0, diff);
  const remaining = deck.slice(diff);
  return {
    newHand: [...hand, ...drawn],
    newDeck: remaining,
  };
}

export function executeUnitAction(
  unit: Unit,
  action: ActionType,
  target: string | null,
  state: DuelState
): BattleResult {
  switch (action) {
    case 'move':
      return { log: `${unit.name} moved.`, updatedUnit: { ...unit, canAttack: true } };
    case 'attack':
      return { log: `${unit.name} attacks target ${target}!`, updatedUnit: { ...unit, canAttack: false } };
    case 'spell':
      return { log: `${unit.name} casts spell on ${target}!`, updatedUnit: { ...unit, canAttack: false } };
    default:
      return { log: `${unit.name} passed.`, updatedUnit: { ...unit, canAttack: false } };
  }
}
