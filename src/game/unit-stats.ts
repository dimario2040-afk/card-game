
import type { Card, Suit, Rank } from "../types";

/** Possible unit archetypes derived from the card's suit. */
export type UnitType = "berserker" | "mage" | "guardian" | "assassin";

/** Computed battle stats for a unit card. */
export interface UnitStats {
  readonly atk: number;
  readonly def: number;
  readonly hp: number;
  readonly spd: number;
  readonly unitType: UnitType;
}

const RANK_VALUES: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
  J: 11, Q: 12, K: 13, A: 14,
};

function hpByRank(rank: Rank): number {
  switch (rank) {
    case "2": case "3": case "4": case "5": return 100;
    case "6": case "7": case "8": case "9": case "10": return 140;
    case "J": case "Q": case "K": return 180;
    case "A": return 220;
  }
}

const SUIT_UNIT_TYPE: Record<Suit, UnitType> = {
  hearts: "berserker",
  diamonds: "mage",
  clubs: "guardian",
  spades: "assassin",
};

export function cardToUnitStats(card: Card): UnitStats {
  const val = RANK_VALUES[card.rank];
  return {
    atk: val,
    def: Math.floor(val / 2),
    hp: hpByRank(card.rank),
    spd: 15 - val,
    unitType: SUIT_UNIT_TYPE[card.suit],
  };
}
