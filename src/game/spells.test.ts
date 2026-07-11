import { describe, it, expect } from "vitest";
import { castSpell, SPELL_CATALOG } from "./spells";
import type { Unit } from "../types/game";

describe("Spell System", () => {
  const caster: Unit = { id: "c", name: "Caster", attack: 0, health: 10, maxHealth: 10, abilities: [], canAttack: true, spd: 5, shield: 0, buffs: {}, sourceCard: null as any };
  const target: Unit = { id: "t", name: "Target", attack: 0, health: 10, maxHealth: 10, abilities: [], canAttack: true, spd: 5, shield: 0, buffs: {}, sourceCard: null as any };

  it("should have 5 spells in catalog", () => {
    expect(Object.keys(SPELL_CATALOG)).toHaveLength(5);
  });

  it("magicArrow deals 3 damage", () => {
    const effect = castSpell("magicArrow", caster, target);
    expect(effect).not.toBeNull();
    expect(effect!.damage).toBe(3);
    expect(effect!.log).toContain("-3❤️");
  });

  it("lightning deals 6 damage", () => {
    const effect = castSpell("lightning", caster, target);
    expect(effect).not.toBeNull();
    expect(effect!.damage).toBe(6);
  });

  it("heal restores 4 HP", () => {
    const effect = castSpell("heal", caster, target);
    expect(effect).not.toBeNull();
    expect(effect!.heal).toBe(4);
  });

  it("shield adds 3 shield", () => {
    const effect = castSpell("shield", caster, target);
    expect(effect).not.toBeNull();
    expect(effect!.shield).toBe(3);
  });

  it("fireball damages all enemies", () => {
    const effect = castSpell("fireball", caster, null);
    expect(effect).not.toBeNull();
    expect(effect!.allEnemyDamage).toBe(3);
  });

  it("returns null for unknown spell", () => {
    const effect = castSpell("unknown", caster, target);
    expect(effect).toBeNull();
  });

  it("magicArrow returns empty log if target is null", () => {
    const effect = castSpell("magicArrow", caster, null);
    expect(effect).not.toBeNull();
    expect(effect!.log).toBe("Цель не выбрана");
    expect(effect!.damage).toBeUndefined();
  });
});
