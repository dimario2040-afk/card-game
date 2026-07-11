import React, { useState } from 'react';
import { useGameStore } from '../../store/game-store';
import type { Card } from '../../types';
import { CardFront } from '../components/CardFront';

export const DraftScreen: React.FC = () => {
  const { playerHand, confirmDraft } = useGameStore();
  const [selectedHero, setSelectedHero] = useState<Card | null>(null);
  const [selectedUnits, setSelectedUnits] = useState<Card[]>([]);

  const isSelectedUnit = (id: string) => selectedUnits.some(u => u.id === id);
  const isSelectedAsHero = (id: string) => selectedHero?.id === id;

  const handleCardClick = (card: Card) => {
    // Если клик по герою — снимаем
    if (isSelectedAsHero(card.id)) {
      setSelectedHero(null);
      return;
    }
    // Если герой ещё не выбран — выбираем
    if (!selectedHero) {
      setSelectedHero(card);
      return;
    }
    // Если клик по выбранному юниту — снимаем
    if (isSelectedUnit(card.id)) {
      setSelectedUnits(prev => prev.filter(u => u.id !== card.id));
      return;
    }
    // Иначе добавляем юнита (макс 5)
    if (selectedUnits.length < 5) {
      setSelectedUnits(prev => [...prev, card]);
    }
  };

  const handleConfirm = () => {
    if (selectedHero && selectedUnits.length === 5) {
      const handCards = playerHand.filter(c =>
        c.id !== selectedHero.id && !selectedUnits.find(u => u.id === c.id)
      );
      confirmDraft(
        { heroCard: selectedHero, fieldCards: selectedUnits, handCards },
        { heroCard: selectedHero, fieldCards: selectedUnits, handCards }
      );
    }
  };

  // Helper to find card text for subtitle
  const selectedCount = (selectedHero ? 1 : 0) + selectedUnits.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0015] via-[#1a0a30] to-[#0d1117] p-4 text-white">
      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="font-game text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gold to-yellow-400">
          Сбор отряда
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Выберите <span className="text-gold">героя</span> (1) и <span className="text-green-400">юнитов</span> (5) из вашей руки
        </p>
        <div className="mt-2 flex items-center justify-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-gold" /> Герой
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-green-400" /> Юнит
          </span>
          <span>{selectedCount}/6 выбрано</span>
        </div>
      </div>

      {/* Card grid */}
      <div className="mx-auto grid max-w-3xl grid-cols-5 gap-4">
        {playerHand.map((card) => {
          const isHero = isSelectedAsHero(card.id);
          const isUnit = isSelectedUnit(card.id);

          return (
            <div key={card.id} className="relative">
              <CardFront card={card} onClick={() => handleCardClick(card)} />

              {/* Label overlay — close to the card, bottom strip */}
              {isHero && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-gold to-yellow-600 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black shadow-lg shadow-gold/30 whitespace-nowrap">
                  👑 Герой
                </div>
              )}
              {isUnit && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-green-600 to-emerald-500 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg shadow-green-500/30 whitespace-nowrap">
                  🛡 Юнит
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirm button */}
      <div className="mt-10 flex justify-center">
        <button
          disabled={!selectedHero || selectedUnits.length !== 5}
          onClick={handleConfirm}
          className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-gold/90 to-yellow-600/90 px-10 py-3 text-base font-bold text-black shadow-lg shadow-gold/20 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-gold/30 disabled:pointer-events-none disabled:opacity-30"
        >
          <span className="relative z-10">
            {!selectedHero
              ? 'Сначала выберите героя'
              : selectedUnits.length < 5
                ? `Выберите юнитов (${selectedUnits.length}/5)`
                : '⚔ В бой!'}
          </span>
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        </button>
      </div>
    </div>
  );
};
