
import type { Card, Suit } from "../types";
import type { DuelState, Unit, FieldLine } from "../types/game";
import type { ActionType } from "../game/battle-loop";

export type Personality = 'aggro' | 'balanced' | 'defensive';

export type BetAction = 'fold' | 'call' | 'raise';

export interface DuelAction {
    readonly action: BetAction;
    readonly amount?: number;
}

function getTarget(targetField: readonly FieldLine[]): Unit | null {
    const targets = targetField.flat().filter((u): u is Unit => u !== null);
    // Приоритет: Lowest HP
    return targets.sort((a, b) => a.health - b.health)[0] || null;
}

export function decideUnitAction(
    unit: Unit,
    state: DuelState,
    personality: Personality
): { action: ActionType, target: string | null } {
    // ИИ атакует юниты игрока (state.playerField)
    const target = getTarget(state.playerField);
    
    if (!target) return { action: 'pass', target: null };

    // Агрессивный ИИ всегда атакует, если цель есть
    if (personality === 'aggro') return { action: 'attack', target: target.id };
    
    // Защитный ИИ предпочитает move, если может (упрощенно)
    if (personality === 'defensive' && unit.canAttack) return { action: 'move', target: null };

    return { action: 'attack', target: target.id };
}

export function decideDuelAction(duelState: DuelState, personality: Personality): DuelAction {
    // Упрощенная логика: блеф зависит от личности
    const bluffChance = personality === 'aggro' ? 0.3 : personality === 'defensive' ? 0.05 : 0.15;
    
    if (Math.random() < bluffChance) return { action: 'raise', amount: 5 };
    
    return { action: 'call' };
}
