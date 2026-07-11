import { describe, it, expect } from "vitest";
import { calculateInitiative, executeUnitAction } from "./battle-loop";
import type { Unit } from "../types/game";

describe("Battle Loop", () => {
  it("calculateInitiative should sort units by SPD descending", () => {
    const u1: Unit = { id: "1", name: "Slow", attack: 1, health: 10, maxHealth: 10, abilities: [], canAttack: true, spd: 1 };
    const u2: Unit = { id: "2", name: "Fast", attack: 1, health: 10, maxHealth: 10, abilities: [], canAttack: true, spd: 10 };
    
    const init = calculateInitiative([[u1], [u2]], []);
    expect(init[0].spd).toBe(10);
    expect(init[1].spd).toBe(1);
  });

  it("executeUnitAction should toggle canAttack for attack action", () => {
    const unit: Unit = { id: "1", name: "Warrior", attack: 5, health: 10, maxHealth: 10, abilities: [], canAttack: true, spd: 5 };
    const result = executeUnitAction(unit, 'attack', 'enemy-id', {} as any);
    expect(result.updatedUnit.canAttack).toBe(false);
  });
});
