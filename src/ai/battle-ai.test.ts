import { describe, it, expect } from "vitest";
import { decideUnitAction, decideDuelAction } from "./battle-ai";
import type { DuelState, Unit } from "../types/game";

describe("Battle AI", () => {
  const unit: Unit = { id: "u1", name: "Warrior", attack: 5, health: 10, maxHealth: 10, abilities: [], canAttack: true, spd: 5 };
  const mockState: DuelState = {
    enemyField: [[{ id: "e1", name: "Enemy", attack: 1, health: 5, maxHealth: 5, abilities: [], canAttack: true, spd: 2 }]],
    playerField: [[unit]],
  } as any;

  it("should make aggro AI attack", () => {
    const decision = decideUnitAction(unit, mockState, 'aggro');
    expect(decision.action).toBe('attack');
  });

  it("should make defensive AI move", () => {
    const decision = decideUnitAction(unit, mockState, 'defensive');
    expect(decision.action).toBe('move');
  });

  it("should result in valid bet action", () => {
    const decision = decideDuelAction(mockState, 'balanced');
    expect(['fold', 'call', 'raise']).toContain(decision.action);
  });
});
