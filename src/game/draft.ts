
import type { Card, Suit, Rank } from "../types";
import type { HeroCard, Unit, FieldLine } from "../types/game";
import { createDeck, shuffle, draw } from "../data/cards";
import { cardToUnitStats, type UnitStats } from "./unit-stats";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RANK_VALUES: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
  J: 11, Q: 12, K: 13, A: 14,
};

const DRAFT_HAND_SIZE = 10;
const FIELD_SIZE = 5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DraftHands {
  readonly playerHand: readonly Card[];
  readonly enemyHand: readonly Card[];
}

export interface DraftSelection {
  heroCard: Card;
  fieldCards: Card[];
  handCards: Card[];
}

export interface DraftConfirmation {
  readonly playerHero: HeroCard;
  readonly enemyHero: HeroCard;
  readonly playerField: readonly FieldLine[];
  readonly enemyField: readonly FieldLine[];
  readonly playerHand: readonly Card[];
  readonly enemyHand: readonly Card[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rankValue(rank: Rank): number {
  return RANK_VALUES[rank];
}

function cardToHero(card: Card): HeroCard {
  const val = rankValue(card.rank);
  return {
    id: `hero-${card.suit}-${card.rank}`,
    name: `${card.rank} of ${card.suit}`,
    health: val * 20,
    maxHealth: val * 20,
    abilities: [],
    shield: 0,
    buffs: {},
  };
}

function cardToUnit(card: Card, heroCard: Card, index: number, side: 'player' | 'enemy'): Unit {
  let stats: UnitStats = cardToUnitStats(card);
  stats = applyHeroBonus(stats, heroCard);
  stats = applyFactionBonus(stats, card.suit, heroCard.suit);
  
  return {
    id: `${side}-unit-${index}`,
    name: `${card.rank} of ${card.suit}`,
    attack: stats.atk,
    health: stats.hp,
    maxHealth: stats.hp,
    abilities: [],
    canAttack: true,
    spd: stats.spd,
    shield: 0,
    buffs: {},
    sourceCard: card,
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function dealDraftHands(): DraftHands {
  const deck = shuffle(createDeck());
  const { drawn: playerHand, remaining: r1 } = draw(deck, DRAFT_HAND_SIZE);
  const { drawn: enemyHand } = draw(r1, DRAFT_HAND_SIZE);
  
  return {
    playerHand: Object.freeze(playerHand),
    enemyHand: Object.freeze(enemyHand),
  };
}

export function applyHeroBonus(stats: UnitStats, heroCard: Card): UnitStats {
  const bonus = Math.floor(rankValue(heroCard.rank) / 2);
  return { ...stats, atk: stats.atk + bonus };
}

export function applyFactionBonus(stats: UnitStats, unitSuit: Suit, heroSuit: Suit): UnitStats {
  if (unitSuit === heroSuit) {
    return { ...stats, atk: stats.atk + 1 };
  }
  return stats;
}

export function confirmDraft(
  playerSelection: DraftSelection,
  enemySelection: DraftSelection,
): DraftConfirmation {
  if (playerSelection.fieldCards.length !== FIELD_SIZE) {
    throw new Error(`Player must select exactly ${FIELD_SIZE} field cards`);
  }
  if (enemySelection.fieldCards.length !== FIELD_SIZE) {
    throw new Error(`Enemy must select exactly ${FIELD_SIZE} field cards`);
  }
  
  const playerHero = cardToHero(playerSelection.heroCard);
  const enemyHero = cardToHero(enemySelection.heroCard);
  
  const playerUnits = playerSelection.fieldCards.map(
    (card, i) => cardToUnit(card, playerSelection.heroCard, i, 'player')
  );
  const enemyUnits = enemySelection.fieldCards.map(
    (card, i) => cardToUnit(card, enemySelection.heroCard, i, 'enemy')
  );
  
  const playerField: FieldLine = Object.freeze(playerUnits) as FieldLine;
  const enemyField: FieldLine = Object.freeze(enemyUnits) as FieldLine;
  
  return {
    playerHero: Object.freeze(playerHero),
    enemyHero: Object.freeze(enemyHero),
    playerField: [playerField],
    enemyField: [enemyField],
    playerHand: Object.freeze([...playerSelection.handCards]),
    enemyHand: Object.freeze([...enemySelection.handCards]),
  };
}
