
import { describe, it, expect } from "vitest";
import { resolveHands } from "./duel-engine";
import type { Unit } from "../types/game";

describe("Duel Engine", () => {
  const attacker: Unit = { id: "a", name: "Attacker", attack: 5, health: 10, maxHealth: 10, abilities: [], canAttack: true };
  const defender: Unit = { id: "d", name: "Defender", attack: 4, health: 10, maxHealth: 10, abilities: [], canAttack: true };

  it("should calculate correct damage when attacker wins", () => {
    // Высокая карта (например, А-high)
    const attCards = [{ suit: "hearts", rank: "A" } as any]; // A = 14
    const defCards = [{ suit: "spades", rank: "2" } as any]; // 2 = 2
    
    const result = resolveHands(attacker, defender, attCards, defCards);
    // attScore = 14 + 5 = 19
    // defScore = 2 + 4 = 6
    // diff = 13. Damage = 13.
    expect(result.attackerDamage).toBe(13);
  });

  it("should calculate counterattack damage when attacker wins", () => {
    const attCards = [{ suit: "hearts", rank: "A" } as any];
    const defCards = [{ suit: "spades", rank: "2" } as any];
    
    const result = resolveHands(attacker, defender, attCards, defCards);
    expect(result.counterDamage).toBeGreaterThan(0); // Defender hits back
  });
});
