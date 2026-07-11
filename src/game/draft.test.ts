import { describe, it, expect, vi } from "vitest";
import { dealDraftHands, confirmDraft, applyHeroBonus, applyFactionBonus } from "./draft";
import { cardToUnitStats } from "./unit-stats";
import type { Card } from "../types/card.js";
import type { DraftSelection } from "./draft.js";

describe("Draft Module", () => {
  it("dealDraftHands should deal 10 cards to each player", () => {
    const hands = dealDraftHands();
    expect(hands.playerHand.length).toBe(10);
    expect(hands.enemyHand.length).toBe(10);
  });

  it("applyHeroBonus should increase ATK based on hero rank", () => {
    const stats = { atk: 10, def: 5, hp: 100, spd: 5, unitType: "berserker" as const };
    const heroCard: Card = { suit: "hearts", rank: "A" }; // A = 14, 14/2 = 7
    const newStats = applyHeroBonus(stats, heroCard);
    expect(newStats.atk).toBe(17);
  });

  it("applyFactionBonus should increase ATK if suit matches", () => {
    const stats = { atk: 10, def: 5, hp: 100, spd: 5, unitType: "berserker" as const };
    const newStats = applyFactionBonus(stats, "hearts", "hearts");
    expect(newStats.atk).toBe(11);
  });

  it("confirmDraft should throw if field cards length is not 5", () => {
    const hero = { suit: "hearts", rank: "A" };
    const sel: DraftSelection = { heroCard: hero, fieldCards: [], handCards: [] };
    expect(() => confirmDraft(sel, sel)).toThrow();
  });
});
