
import type { Unit } from "../types/game";

// ─── Spell effect descriptor ──────────────────────────────────────────
// Pure data — the store reads this and applies actual state changes.

export interface SpellEffect {
  readonly log: string;
  readonly damage?: number;          // damage to target unit
  readonly heal?: number;            // heal target unit
  readonly shield?: number;          // add shield to target unit
  readonly allEnemyDamage?: number;  // damage to ALL enemy units
}

export type SpellTargetType = 'enemy' | 'ally' | 'none';

export interface Spell {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly cost: number;
  readonly targetType: SpellTargetType;
  readonly effect: (caster: Unit, target: Unit | null) => SpellEffect;
}

// ─── Spell catalog ────────────────────────────────────────────────────

export const SPELL_CATALOG: Record<string, Spell> = {
  magicArrow: {
    id: 'magicArrow',
    name: 'Волшебная стрела',
    description: 'Наносит 3 урона цели',
    cost: 1,
    targetType: 'enemy',
    effect: (caster, target) => {
      if (!target) return { log: 'Цель не выбрана' };
      return {
        log: `🔮 ${caster.name} кастует Волшебную стрелу → ${target.name}: -3❤️`,
        damage: 3,
      };
    },
  },

  lightning: {
    id: 'lightning',
    name: 'Молния',
    description: 'Наносит 6 урона цели',
    cost: 2,
    targetType: 'enemy',
    effect: (caster, target) => {
      if (!target) return { log: 'Цель не выбрана' };
      return {
        log: `⚡ ${caster.name} поражает молнией ${target.name}: -6❤️`,
        damage: 6,
      };
    },
  },

  heal: {
    id: 'heal',
    name: 'Лечение',
    description: 'Восстанавливает 4 HP союзнику',
    cost: 2,
    targetType: 'ally',
    effect: (caster, target) => {
      if (!target) return { log: 'Цель не выбрана' };
      return {
        log: `💚 ${caster.name} лечит ${target.name}: +4❤️`,
        heal: 4,
      };
    },
  },

  shield: {
    id: 'shield',
    name: 'Щит',
    description: 'Даёт 3 щита союзнику',
    cost: 2,
    targetType: 'ally',
    effect: (caster, target) => {
      if (!target) return { log: 'Цель не выбрана' };
      return {
        log: `🛡 ${caster.name} ставит щит на ${target.name}: +3🛡`,
        shield: 3,
      };
    },
  },

  fireball: {
    id: 'fireball',
    name: 'Огненный шар',
    description: 'Наносит 3 урона всем врагам',
    cost: 3,
    targetType: 'none',
    effect: (caster, _target) => ({
      log: `🔥 ${caster.name} запускает Огненный шар! Все враги получают -3❤️`,
      allEnemyDamage: 3,
    }),
  },
};

// ─── Pure resolver ────────────────────────────────────────────────────
// Returns the SpellEffect descriptor, or null if spell not found.
// Chip cost check is done by the caller (store).

export function castSpell(spellId: string, caster: Unit, target: Unit | null): SpellEffect | null {
  const spell = SPELL_CATALOG[spellId];
  if (!spell) return null;
  return spell.effect(caster, target);
}
