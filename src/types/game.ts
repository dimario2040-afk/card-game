import type { Card, PokerHand } from './index';

export type UnitType = 'melee' | 'ranged' | 'flying' | 'spellcaster' | 'berserker' | 'mage' | 'guardian' | 'assassin';
export type Line = 'front' | 'back';

export interface Unit {
  id: string;
  name: string;
  attack: number;
  health: number;
  maxHealth: number;
  abilities: string[];
  canAttack: boolean;
  spd: number;
  shield: number;
  buffs: Record<string, number>;
  sourceCard: Card; // оригинальная карта для отображения
}

export type FieldLine = (Unit | null)[];

export interface HeroCard {
  id: string;
  name: string;
  health: number;
  maxHealth: number;
  abilities: string[];
  shield: number; // <--- ДОБАВЛЕНО
  buffs: Record<string, number>; // <--- ДОБАВЛЕНО
}

export interface DraftSelection {
  heroCard: Card;
  fieldCards: Card[];
  handCards: Card[];
}

export type DuelPhase = 'menu' | 'draft' | 'play' | 'combat' | 'resolution' | 'finished';

export interface DuelState {
  phase: DuelPhase;
  turnNumber: number;
  playerId: string;
  enemyId: string;
  playerHero: HeroCard | null;
  enemyHero: HeroCard | null;
  playerField: FieldLine[];
  enemyField: FieldLine[];
  playerHand: Card[];
  playerHandType: PokerHand | null;
  enemyHandType: PokerHand | null;
  playerChips: number;
  enemyChips: number;
  currentBet: number;
  draftPool: Card[];
  draftSelections: DraftSelection[];
  combatLog: string[];
  winner: string | null;
  selectedCardIds: string[];
  activeAttackerCards: Card[]; // <--- ДОБАВЛЕНО
  activeDefenderCards: Card[]; // <--- ДОБАВЛЕНО
  selectedPlayerUnitId: string | null;
  selectedEnemyUnitId: string | null;
}
