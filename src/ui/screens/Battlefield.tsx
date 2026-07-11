
import React, { useState, useMemo } from 'react';
import { useGameStore } from '../../store/game-store';
import { CardFront } from '../components/CardFront';
import { findBestHand, HAND_TYPE_NAMES } from '../../game/hand-evaluator';
import { calculateDamage } from '../../game/combat-engine';
import { SPELL_CATALOG } from '../../game/spells';
import type { Spell } from '../../game/spells';

export const Battlefield: React.FC = () => {
  const {
    playerField, enemyField, playerHero, enemyHero, phase, endTurn,
    combatLog, attack, castSpell, playHand,
    selectedPlayerUnitId, selectPlayerUnit,
    selectedEnemyUnitId, selectEnemyUnit,
    playerHand, selectedCardIds, selectCard, deselectCard,
    playerChips,
  } = useGameStore();
  const [showTutorial, setShowTutorial] = useState(true);

  // ─── Hand evaluation & damage preview ─────────────────────────
  const selectedCards = useMemo(
    () => playerHand.filter(c => selectedCardIds.includes(c.id)),
    [playerHand, selectedCardIds],
  );

  const handPreview = useMemo(() => {
    if (selectedCards.length < 5) return null;
    const evalResult = findBestHand(selectedCards);
    const name = HAND_TYPE_NAMES[evalResult.handType];
    const dmgResult = calculateDamage(selectedCards,
      { classAbility: 'none', classMultiplier: 1, relicMultiplier: 1, bonusDamage: 0, buffs: {} },
      { shield: enemyHero?.shield ?? 0, buffs: {} },
    );
    const russianName: Record<string, string> = {
      HIGH_CARD: 'Старшая карта', ONE_PAIR: 'Пара', TWO_PAIR: 'Две пары',
      THREE_OF_A_KIND: 'Тройка', STRAIGHT: 'Стрит', FLUSH: 'Флэш',
      FULL_HOUSE: 'Фулл-хаус', FOUR_OF_A_KIND: 'Каре',
      STRAIGHT_FLUSH: 'Стрит-флэш', ROYAL_FLUSH: 'Роял-флэш',
    };
    return {
      handName: russianName[name] ?? name,
      damage: dmgResult.totalDamage,
      breakdown: dmgResult.breakdown,
    };
  }, [selectedCards, enemyHero]);

  // ─── Unit attack validation ───────────────────────────────────
  const canAttack = selectedPlayerUnitId && selectedEnemyUnitId;
  let selectedUnitCanAttack = true;
  if (selectedPlayerUnitId) {
    const u = playerField.flat().find(u => u?.id === selectedPlayerUnitId);
    if (u) selectedUnitCanAttack = u.canAttack;
  }

  // ─── Spell helpers ────────────────────────────────────────────
  const spells = Object.values(SPELL_CATALOG);
  const spellTargetOk = (s: Spell) => {
    if (s.targetType === 'enemy') return !!selectedEnemyUnitId;
    if (s.targetType === 'ally') return !!selectedPlayerUnitId;
    return true; // 'none' — always targetable
  };
  const spellTargetId = (s: Spell) => {
    if (s.targetType === 'enemy') return selectedEnemyUnitId;
    if (s.targetType === 'ally') return selectedPlayerUnitId;
    return null;
  };

  return (
    <div className="p-6 bg-surface-dark min-h-screen text-white">

      {/* ─── Tutorial ─────────────────────────────────────────── */}
      {showTutorial && (
        <div className="mb-4 p-4 bg-blue-900/30 border border-blue-500/30 rounded relative">
          <button onClick={() => setShowTutorial(false)} className="absolute top-2 right-2 text-blue-300 hover:text-white">✕</button>
          <h3 className="font-bold text-blue-300 mb-2">📖 Правила дуэли:</h3>
          <ul className="text-sm text-blue-200/80 space-y-1">
            <li>1. <b>Разыграйте комбинацию</b> — выберите ≥5 карт из руки, получите покерную руку и нанесите урон герою врага</li>
            <li>2. <b>Атакуйте юнитами</b> — кликните своего юнита (синяя рамка), затем врага (красная), нажмите ⚔ Атака</li>
            <li>3. <b>Заклинания</b> — тратят фишки (💎), наносят урон / лечат / дают щит. Выберите цель и кастуйте!</li>
            <li>4. <b>End Turn</b> — враг атакует вас, затем ход переходит к вам (+5💎)</li>
            <li>💡 Побеждает тот, кто убьёт всех вражеских юнитов</li>
          </ul>
        </div>
      )}

      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold">Бой (Ход {})</h2>
        <span className="text-gold font-bold text-sm">💎 {playerChips}</span>
      </div>

      <div className="mb-4 text-xs text-gray-400 flex gap-4 flex-wrap">
        <span>📌 Ваш юнит: {selectedPlayerUnitId ? selectedPlayerUnitId.replace('player-unit-', 'Юнит ') : '❌'}</span>
        <span>🎯 Цель: {selectedEnemyUnitId ? selectedEnemyUnitId.replace('enemy-unit-', 'Враг ') : '❌'}</span>
        {selectedPlayerUnitId && !selectedUnitCanAttack && <span className="text-yellow-400">⚠ Уже атаковал</span>}
      </div>

      {/* ─── Поле врага ───────────────────────────────────────── */}
      <div className="mb-4 p-4 border border-red-500/30 rounded bg-red-900/5 grid grid-cols-5 gap-2">
        <h3 className="text-red-400 font-bold col-span-5">👹 Враг: {enemyHero?.name} (❤️ {enemyHero?.health})</h3>
        {enemyField[0]?.map((unit, i) => (
            <div key={i}
              onClick={() => unit && selectEnemyUnit(unit.id)}
              className={`relative cursor-pointer transition-all rounded ${
                selectedEnemyUnitId === unit?.id ? 'ring-2 ring-red-400 scale-105' : 'hover:ring-1 hover:ring-red-400/50'
              }`}>
                {unit
                  ? <div className="relative">
                      <CardFront card={unit.sourceCard} />
                      <div className="absolute bottom-0 left-0 right-0 rounded-b-[10px] bg-gradient-to-t from-black/85 to-black/40 px-1.5 py-0.5 text-[11px] leading-tight">
                        <div className="flex items-center justify-between text-red-300 font-bold">
                          <span>❤️{unit.health}</span>
                          <span>⚔{unit.attack}</span>
                          <span className="text-[9px]">{unit.canAttack ? '🏃' : '💤'}</span>
                        </div>
                      </div>
                    </div>
                  : <div className="h-36 w-26 flex items-center justify-center bg-black/30 rounded-xl text-gray-600">💀</div>}
            </div>
        ))}
      </div>

      {/* ─── Лог боя ──────────────────────────────────────────── */}
      <div className="mb-4 p-2 h-20 overflow-y-auto bg-black/40 text-xs rounded border border-white/10">
        {combatLog.length === 0
          ? <p className="text-gray-500 italic">Лог боя пуст...</p>
          : combatLog.slice(-6).map((log, i) => <p key={i} className="text-gray-300">{log}</p>)}
      </div>

      {/* ─── Панель управления ────────────────────────────────── */}
      <div className="my-4 p-4 bg-gray-800/60 rounded space-y-3">
        {/* Строка атаки */}
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-xs text-gray-400 w-16">⚔ Атака:</span>
          <button
            onClick={() => canAttack && selectedUnitCanAttack && attack(selectedPlayerUnitId!, selectedEnemyUnitId!)}
            className="px-4 py-2 bg-red-600 text-white rounded disabled:bg-gray-600 disabled:text-gray-400 transition hover:bg-red-500 text-sm"
            disabled={!canAttack || !selectedUnitCanAttack}
          >
            ⚔ Атака юнитом
          </button>
          <span className="text-xs text-gray-500 ml-1">
            {selectedPlayerUnitId && selectedEnemyUnitId ? 'готово' : 'выберите юнит → врага'}
          </span>
        </div>

        {/* Строка заклинаний */}
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-xs text-gray-400 w-16">🔮 Магия:</span>
          {spells.map(s => {
            const canCast = playerChips >= s.cost && spellTargetOk(s);
            return (
              <button
                key={s.id}
                onClick={() => canCast && castSpell(s.id, spellTargetId(s))}
                disabled={!canCast}
                className="px-3 py-1.5 bg-purple-700/80 text-white rounded disabled:bg-gray-700 disabled:text-gray-500 transition hover:bg-purple-600 text-xs relative group"
              >
                {s.name} ({s.cost}💎)
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none">
                  {s.description}
                </div>
              </button>
            );
          })}
        </div>

        {/* End Turn */}
        <div className="flex justify-end">
          <button onClick={endTurn} className="px-6 py-2 bg-gold text-black rounded font-bold hover:bg-yellow-500 transition text-sm">
            ⏭ End Turn
          </button>
        </div>
      </div>

      {/* ─── Поле игрока ──────────────────────────────────────── */}
      <div className="mb-4 p-4 border border-blue-500/30 rounded bg-blue-900/5 grid grid-cols-5 gap-2">
        <h3 className="text-blue-400 font-bold col-span-5">🛡 Игрок: {playerHero?.name}</h3>
        {playerField[0]?.map((unit, i) => (
            <div key={i} onClick={() => unit && selectPlayerUnit(unit.id)} className={`relative cursor-pointer transition-all rounded ${
              selectedPlayerUnitId === unit?.id ? 'ring-2 ring-blue-400 scale-105' : 'hover:ring-1 hover:ring-blue-400/50'
            }`}>
                {unit
                  ? <div className="relative">
                      <CardFront card={unit.sourceCard} />
                      <div className="absolute bottom-0 left-0 right-0 rounded-b-[10px] bg-gradient-to-t from-black/85 to-black/40 px-1.5 py-0.5 text-[11px] leading-tight">
                        <div className="flex items-center justify-between text-blue-300 font-bold">
                          <span>❤️{unit.health}</span>
                          <span>⚔{unit.attack}</span>
                          <span className="text-[9px]">{unit.canAttack ? '🏃' : '💤'}</span>
                        </div>
                      </div>
                    </div>
                  : <div className="h-36 w-26 flex items-center justify-center bg-black/30 rounded-xl text-gray-600">💀</div>}
            </div>
        ))}
      </div>

      {/* ─── Рука игрока ──────────────────────────────────────── */}
      <div className="mt-6 p-4 border border-yellow-500/30 rounded bg-yellow-900/5">
        <h3 className="text-yellow-400 font-bold mb-1">
          🃏 Рука ({playerHand.length}) — выберите карты для комбинации
        </h3>
        {handPreview && (
          <div className="mb-2 text-sm text-yellow-300/90">
            🏆 Комбинация: <b>{handPreview.handName}</b> — урон герою: <b className="text-red-400">{handPreview.damage}❤️</b>
            <span className="text-xs text-gray-500 ml-2">
              (база: {handPreview.breakdown.baseChips} × {handPreview.breakdown.baseMult})
            </span>
          </div>
        )}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {playerHand.map((card) => (
            <div key={card.id} className="flex-shrink-0 relative"
              onClick={() => selectedCardIds.includes(card.id) ? deselectCard(card.id) : selectCard(card.id)}>
              <CardFront card={card} />
              {selectedCardIds.includes(card.id) && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 text-black text-xs font-bold rounded-full flex items-center justify-center shadow-md">
                  ✓
                </div>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={() => selectedCardIds.length >= 5 && playHand(selectedCardIds)}
          disabled={selectedCardIds.length < 5}
          className="mt-3 px-6 py-2 bg-yellow-600 text-black rounded font-bold disabled:bg-gray-600 disabled:text-gray-400 transition hover:bg-yellow-500 text-sm"
        >
          ▶ Разыграть комбинацию ({selectedCardIds.length})
        </button>
        {selectedCardIds.length > 0 && selectedCardIds.length < 5 && (
          <p className="text-xs text-yellow-600 mt-1">Выберите минимум 5 карт</p>
        )}
      </div>
    </div>
  );
};


