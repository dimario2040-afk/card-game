import type { Card } from "../types";
import { confirmDraft, type DraftSelection } from "../game/draft";

export interface DraftAction {
  readonly hero: Card;
  readonly units: readonly Card[];
}

export function decideDraftAction(hand: readonly Card[]): DraftAction {
  if (hand.length === 0) {
    return {
      hero: { id: "fallback-hero", suit: "hearts", rank: "2" },
      units: [],
    };
  }

  // Rank values for hero selection
  const RANK_VALUES: Record<string, number> = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
    J: 11, Q: 12, K: 13, A: 14,
  };

  const sortedHand = [...hand].sort((a, b) => {
    const valA = RANK_VALUES[a.rank];
    const valB = RANK_VALUES[b.rank];
    if (valA !== valB) return valB - valA;
    return a.suit.localeCompare(b.suit);
  });

  const hero = sortedHand[0];
  const remaining = sortedHand.slice(1);

  // Suit synergy: count suit frequencies
  const suitCounts: Record<string, number> = {};
  remaining.forEach((card) => {
    suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
  });

  const targetSuit = Object.entries(suitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || remaining[0]?.suit || "hearts";

  // Pick units
  const units = [...remaining].sort((a, b) => {
    const isTargetA = a.suit === targetSuit ? 1 : 0;
    const isTargetB = b.suit === targetSuit ? 1 : 0;
    if (isTargetA !== isTargetB) return isTargetB - isTargetA;
    return RANK_VALUES[b.rank] - RANK_VALUES[a.rank];
  }).slice(0, 5);

  return { hero, units };
}
