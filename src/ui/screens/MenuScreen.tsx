import React, { useState } from 'react';
import { useGameStore } from '../../store/game-store';

// ─── Floating card in the background ─────────────────────────────────

interface FloatCard {
  id: number;
  suit: string;
  rank: string;
  x: number;
  y: number;
  rotation: number;
  delay: number;
  duration: number;
}

function generateFloatCards(): FloatCard[] {
  const suits = ['♠', '♥', '♣', '♦'];
  const ranks = ['A', 'K', 'Q', 'J', '10', '9'];
  return Array.from({ length: 12 }, (_, i) => ({
    id: i,
    suit: suits[i % 4],
    rank: ranks[i % 6],
    x: Math.random() * 100,
    y: Math.random() * 100,
    rotation: Math.random() * 60 - 30,
    delay: Math.random() * 5,
    duration: 12 + Math.random() * 10,
  }));
}

// ─── Component ────────────────────────────────────────────────────────

export const MenuScreen: React.FC = () => {
  const { startGame } = useGameStore();
  const [floatCards] = useState(generateFloatCards);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#0a0015] via-[#1a0a30] to-[#0d1117]">
      {/* ─── Background floating cards ──────────────────────── */}
      {floatCards.map((fc) => (
        <div
          key={fc.id}
          className="absolute pointer-events-none select-none animate-float-card"
          style={{
            left: `${fc.x}%`,
            top: `${fc.y}%`,
            transform: `rotate(${fc.rotation}deg)`,
            animationDelay: `${fc.delay}s`,
            animationDuration: `${fc.duration}s`,
          }}
        >
          <div className="flex h-14 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-sm backdrop-blur-sm">
            <span className={fc.suit === '♥' || fc.suit === '♦' ? 'text-red-400/40' : 'text-white/30'}>
              {fc.rank}{fc.suit}
            </span>
          </div>
        </div>
      ))}

      {/* ─── Animated glowing orbs ─────────────────────────── */}
      <div className="absolute left-1/4 top-1/3 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/10 blur-3xl animate-pulse-soft" />
      <div className="absolute right-1/4 top-2/3 h-72 w-72 -translate-y-1/2 rounded-full bg-gold/5 blur-3xl animate-pulse-soft" style={{ animationDelay: '2s' }} />

      {/* ─── Content ───────────────────────────────────────── */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 text-center">
        {/* Decorative line top */}
        <div className="mb-6 h-px w-48 bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

        {/* Title */}
        <h1 className="font-game text-5xl font-extrabold leading-tight tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-gold via-yellow-300 to-amber-600 md:text-7xl animate-glow">
          Герои Покера
          <br />
          <span className="text-3xl md:text-5xl bg-gradient-to-r from-purple-300 via-mystic-purple to-purple-400 bg-clip-text">
            и Магии
          </span>
        </h1>
        <p className="mt-3 text-lg font-light tracking-widest text-gray-400 uppercase">
          Дуэль
        </p>

        {/* Decorative suits row */}
        <div className="mt-6 flex gap-6 text-2xl text-white/20">
          <span className="text-red-400/40">♠</span>
          <span className="text-red-400/40">♥</span>
          <span className="text-red-400/40">♣</span>
          <span className="text-red-400/40">♦</span>
        </div>

        {/* Divider */}
        <div className="my-8 h-px w-32 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* Start button */}
        <button
          onClick={startGame}
          className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-gold/90 to-yellow-600/90 px-10 py-4 text-lg font-bold text-black shadow-lg shadow-gold/20 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-gold/30"
        >
          <span className="relative z-10">🎴 Начать дуэль</span>
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        </button>

        {/* Subtitle */}
        <p className="mt-6 max-w-xs text-xs leading-relaxed text-gray-500">
          Тактическая карточная дуэль. Соберите отряд, разыгрывайте покерные комбинации и уничтожьте врага.
        </p>

        {/* Decorative line bottom */}
        <div className="mt-8 h-px w-48 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      </div>
    </div>
  );
};
