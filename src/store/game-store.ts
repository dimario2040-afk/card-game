
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { DuelState, DuelPhase, Unit } from '../types/game';
import type { Card } from '../types';
import { dealDraftHands, confirmDraft, type DraftSelection } from '../game/draft';
import { decideDraftAction } from '../ai/draft-ai';
import { calculateDamage } from '../game/combat-engine';
import { executeUnitAction } from '../game/battle-loop';
import { resolveHands } from '../game/duel-engine';
import { castSpell, SPELL_CATALOG } from '../game/spells';
import { decideUnitAction } from '../ai/battle-ai';

export interface GameActions {
  startGame: () => void;
  initDraft: () => void;
  confirmDraft: (playerSel: DraftSelection, enemySel: DraftSelection) => void;
  playHand: (cardIds: string[]) => void;
  attack: (attackerId: string, targetId: string) => void;
  castSpell: (spellId: string, targetId: string | null) => void;
  selectCard: (id: string) => void;
  deselectCard: (id: string) => void;
  selectPlayerUnit: (id: string | null) => void; // <--- ДОБАВЛЕНО
  selectEnemyUnit: (id: string | null) => void;
  checkWinCondition: () => void;
  endTurn: () => void;
  resetGame: () => void;
}

export type GameStore = DuelState & GameActions;

const INITIAL_STATE: Omit<DuelState, 'phase' | 'turnNumber'> = {
  playerId: 'player',
  enemyId: 'enemy',
  playerHero: null as any,
  enemyHero: null as any,
  playerField: [],
  enemyField: [],
  playerHand: [],
  playerHandType: null,
  enemyHandType: null,
  playerChips: 20,
  enemyChips: 20,
  currentBet: 0,
  draftPool: [],
  draftSelections: [],
  selectedCardIds: [],
  combatLog: [],
  winner: null,
  activeAttackerCards: [],
  activeDefenderCards: [],
  selectedPlayerUnitId: null,
  selectedEnemyUnitId: null,
};

export const useGameStore = create<GameStore>()(
  immer((set) => ({
    ...INITIAL_STATE,
    phase: 'menu',
    turnNumber: 1,

    startGame: () => set((state) => {
      state.phase = 'draft';
      const { playerHand } = dealDraftHands();
      state.playerHand = playerHand;
    }),

    initDraft: () => set((state) => {
      const { playerHand, enemyHand } = dealDraftHands();
      state.playerHand = playerHand;
      state.phase = 'draft';
      // Enemy hand is hidden in draft state initially
    }),

    confirmDraft: (playerSel, enemySel) => set((state) => {
      const confirmation = confirmDraft(playerSel, enemySel);
      state.playerHero = confirmation.playerHero;
      state.enemyHero = confirmation.enemyHero;
      state.playerField = confirmation.playerField;
      state.enemyField = confirmation.enemyField;
      state.playerHand = [...confirmation.playerHand];
      state.phase = 'play';
    }),

    playHand: (cardIds) => set((state) => {
      if (state.phase !== 'play' || !state.playerHero || !state.enemyHero) return;
      
      const cards = state.playerHand.filter(card => cardIds.includes(card.id));
      state.playerHand = state.playerHand.filter(card => !cardIds.includes(card.id));
      
      const attackerModifiers = {
        classAbility: 'none' as const,
        classMultiplier: 1,
        relicMultiplier: 1,
        bonusDamage: 0,
        buffs: state.playerHero.buffs,
      };

      const defenderStats = {
        shield: state.enemyHero.shield,
        buffs: state.enemyHero.buffs,
      };

      const result = calculateDamage(cards, attackerModifiers, defenderStats);
      
      state.activeAttackerCards = cards; // <--- ДОБАВЛЕНО
      
      state.enemyHero.health = Math.max(0, state.enemyHero.health - result.totalDamage);
      state.combatLog.push(`Player dealt ${result.totalDamage} damage!`);
      
      state.phase = 'combat';
    }),

    selectCard: (id) => set((state) => {
      if (!state.selectedCardIds.includes(id)) {
        state.selectedCardIds.push(id);
      }
    }),
    deselectCard: (id) => set((state) => {
      state.selectedCardIds = state.selectedCardIds.filter(cid => cid !== id);
    }),
    selectPlayerUnit: (id) => set((state) => {
      state.selectedPlayerUnitId = id;
    }),
    selectEnemyUnit: (id) => set((state) => {
      state.selectedEnemyUnitId = id;
    }),

    endTurn: () => set((state) => {
      // Ход ИИ: все юниты врага принимают решение и атакуют
      state.enemyField.forEach(line => line.forEach((u, i) => {
        if (u) {
            const decision = decideUnitAction(u, state, 'balanced');
            const battleResult = executeUnitAction(u, decision.action, decision.target, state);
            line[i] = battleResult.updatedUnit;
            state.combatLog.push(battleResult.log);
            
            // Если атака — наносим урон игроку
            if (decision.action === 'attack') {
                const targetUnit = state.playerField.flat().find(unit => unit?.id === decision.target);
                if (targetUnit) {
                    targetUnit.health -= u.attack;
                    state.combatLog.push(`Enemy ${u.name} dealt ${u.attack} damage!`);
                }
            }
        }
      }));
      
      // Удаляем мертвые юниты игрока
      state.playerField.forEach(line => line.forEach((u, i) => { if (u && u.health <= 0) line[i] = null; }));
      
      // Сбрасываем canAttack для всех юнитов игрока на новый ход
      state.playerField.forEach(line => line.forEach(u => { if (u) u.canAttack = true; }));

      state.turnNumber += 1;
      state.phase = 'play';
      state.playerChips += 5; // Восстановление
    }),

    attack: (attackerId, targetId) => set((state) => {
      let attackerUnit: Unit | null = null;
      state.playerField.forEach(line => line.forEach(u => { if (u?.id === attackerId) attackerUnit = u; }));
      
      let defenderUnit: Unit | null = null;
      state.enemyField.forEach(line => line.forEach(u => { if (u?.id === targetId) defenderUnit = u; }));

      if (!attackerUnit || !defenderUnit) return;
      if (!attackerUnit.canAttack) {
        state.combatLog.push(`${attackerUnit.name} already attacked this turn!`);
        return;
      }
      
      // Выполнение действия юнита
      const battleResult = executeUnitAction(attackerUnit, 'attack', targetId, state);
      
      // Применяем результат (обновляем юнит)
      state.playerField.forEach(line => line.forEach((u, i) => {
        if (u?.id === attackerId) line[i] = battleResult.updatedUnit;
      }));

      // Простой урон
      defenderUnit.health -= attackerUnit.attack;
      state.combatLog.push(battleResult.log);
      state.combatLog.push(`Dealt ${attackerUnit.attack} damage to ${defenderUnit.name}.`);

      // Удаляем мертвые юниты
      state.playerField.forEach(line => line.forEach((u, i) => { if (u && u.health <= 0) line[i] = null; }));
      state.enemyField.forEach(line => line.forEach((u, i) => { if (u && u.health <= 0) line[i] = null; }));

      // Проверка победы
      const enemyDead = state.enemyField.every(line => line.every(u => u === null || u.health <= 0));
      if (enemyDead) {
          state.phase = 'finished';
          state.winner = 'player';
      }
    }),
    castSpell: (spellId, targetId) => set((state) => {
      const spell = SPELL_CATALOG[spellId];
      if (!spell || !state.playerHero) return;
      if (state.playerChips < spell.cost) {
        state.combatLog.push('❌ Недостаточно фишек');
        return;
      }

      // Caster = первый живой юнит игрока, или герой
      const caster = state.playerField.flat().find(u => u !== null) ?? state.playerHero as any;

      // Найти цель по ID (в обоих полях)
      const findUnit = (id: string): Unit | null => {
        for (const line of [...state.playerField, ...state.enemyField]) {
          for (const unit of line) {
            if (unit?.id === id) return unit;
          }
        }
        return null;
      };

      const target = targetId ? findUnit(targetId) : null;

      const effect = castSpell(spellId, caster as Unit, target);
      if (!effect) return;

      state.playerChips -= spell.cost;

      // Применяем эффекты
      if (effect.damage && target) target.health -= effect.damage;
      if (effect.heal && target) target.health = Math.min(target.maxHealth, target.health + effect.heal);
      if (effect.shield && target) target.shield += effect.shield as number;
      if (effect.allEnemyDamage) {
        state.enemyField.forEach(line => line.forEach(u => { if (u) u.health -= effect.allEnemyDamage!; }));
      }

      state.combatLog.push(effect.log);

      // Удаляем мёртвые юниты после заклинания
      state.playerField.forEach(line => line.forEach((u, i) => { if (u && u.health <= 0) line[i] = null; }));
      state.enemyField.forEach(line => line.forEach((u, i) => { if (u && u.health <= 0) line[i] = null; }));

      // Проверка победы
      const enemyDead = state.enemyField.every(line => line.every(u => u === null || u.health <= 0));
      if (enemyDead) {
        state.phase = 'finished';
        state.winner = 'player';
      }
    }),

    checkWinCondition: () => set((state) => {
      const playerDead = state.playerField.every(line => line.every(u => u === null || u.health <= 0));
      const enemyDead = state.enemyField.every(line => line.every(u => u === null || u.health <= 0));
      
      if (playerDead || enemyDead) {
        state.phase = 'finished';
        state.winner = playerDead ? 'enemy' : 'player';
      }
    }),

    resetGame: () => set(() => ({
      ...INITIAL_STATE,
      phase: 'menu',
      turnNumber: 1,
    })),
  }))
);
