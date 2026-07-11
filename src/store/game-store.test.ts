import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './game-store';
import { dealDraftHands } from '../game/draft';

describe('GameStore (DuelState)', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
  });

  it('should initialize draft phase', () => {
    useGameStore.getState().initDraft();
    const state = useGameStore.getState();
    expect(state.phase).toBe('draft');
    expect(state.playerHand.length).toBe(10);
  });

  it('should confirm draft and transition to play phase', () => {
    useGameStore.getState().initDraft();
    const state = useGameStore.getState();
    
    // Эмуляция выбора игрока: 1 герой, 5 юнитов, 4 в руке
    const playerSel = {
      heroCard: state.playerHand[0],
      fieldCards: state.playerHand.slice(1, 6),
      handCards: state.playerHand.slice(6, 10),
    };
    
    useGameStore.getState().confirmDraft(playerSel, playerSel);
    
    const newState = useGameStore.getState();
    expect(newState.phase).toBe('play');
    expect(newState.playerHero).toBeDefined();
    expect(newState.playerField.length).toBe(1); // 1 ряд юнитов
    expect(newState.playerHand.length).toBe(4); // 4 карты в руке
  });

  it('should transition to combat phase after playing hand', () => {
    useGameStore.getState().initDraft();
    const state = useGameStore.getState();
    
    // Эмуляция выбора игрока
    const playerSel = {
      heroCard: state.playerHand[0],
      fieldCards: state.playerHand.slice(1, 6),
      handCards: state.playerHand.slice(6, 10),
    };
    useGameStore.getState().confirmDraft(playerSel, playerSel);
    
    // Разыгрываем 5 карт
    const hand = useGameStore.getState().playerHand;
    const cardsToPlay = hand.map(c => c.id);
    useGameStore.getState().playHand(cardsToPlay);
    
    expect(useGameStore.getState().phase).toBe('combat');
  });

  it('should advance turn and return to play phase on endTurn', () => {
    useGameStore.getState().endTurn();
    expect(useGameStore.getState().turnNumber).toBe(2);
    expect(useGameStore.getState().phase).toBe('play');
  });
});
