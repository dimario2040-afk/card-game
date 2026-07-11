
import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/game-store';

// ─── Sparkle particle for win animation ──────────────────────────────

interface Sparkle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  color: string;
}

function generateSparkles(count: number): Sparkle[] {
  const colors = ['#FFD700', '#FF6B6B', '#48C9B0', '#F5B041', '#BB8FCE', '#85C1E9'];
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 4 + Math.random() * 8,
    delay: Math.random() * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
}

// ─── Component ────────────────────────────────────────────────────────

export const ResultScreen: React.FC = () => {
  const { winner, resetGame, turnNumber } = useGameStore();
  const isWin = winner === 'player';
  const [sparkles] = useState(() => generateSparkles(30));

  useEffect(() => {
    if (isWin) {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.15 + 0.4);
        osc.start(audioCtx.currentTime + i * 0.15);
        osc.stop(audioCtx.currentTime + i * 0.15 + 0.4);
      });
    }
  }, [isWin]);

  return (
    <div className={`relative flex flex-col items-center justify-center min-h-screen p-6 overflow-hidden ${
      isWin ? 'bg-gradient-to-br from-yellow-900 via-purple-900 to-blue-900' : 'bg-gradient-to-br from-gray-900 via-red-900 to-gray-900'
    }`}>
      {/* ─── Sparkles (win only) ───────────────────────────── */}
      {isWin && sparkles.map(s => (
        <div
          key={s.id}
          className="absolute rounded-full animate-ping opacity-70"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            backgroundColor: s.color,
            animationDelay: `${s.delay}s`,
            animationDuration: '1.5s',
          }}
        />
      ))}

      {/* ─── Stars (win only) ──────────────────────────────── */}
      {isWin && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 20 }, (_, i) => (
            <span
              key={i}
              className="absolute text-lg animate-twinkle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                opacity: 0,
              }}
            >
              ✦
            </span>
          ))}
        </div>
      )}

      {/* ─── Content ───────────────────────────────────────── */}
      <div className={`relative z-10 text-center ${isWin ? 'animate-bounce-in' : ''}`}>
        {isWin ? (
          <>
            <div className="text-7xl mb-4">🏆</div>
            <h1 className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-gold to-yellow-500 mb-2">
              ПОБЕДА!
            </h1>
            <p className="text-xl text-yellow-200/80 mb-2">Вы одолели всех вражеских юнитов!</p>
            <div className="flex gap-6 justify-center text-sm text-yellow-200/60 mb-6">
              <span>Ходов: {turnNumber}</span>
            </div>
          </>
        ) : (
          <>
            <div className="text-7xl mb-4">💀</div>
            <h1 className="text-5xl font-extrabold text-red-400 mb-2">
              ПОРАЖЕНИЕ
            </h1>
            <p className="text-lg text-red-200/70 mb-2">Противник оказался сильнее...</p>
            <div className="text-sm text-red-200/50 mb-6">
              Вы продержались {turnNumber} ходов
            </div>
          </>
        )}

        <button
          onClick={resetGame}
          className={`px-10 py-4 rounded-xl font-bold text-lg transition-all duration-200 hover:scale-105 ${
            isWin
              ? 'bg-gold text-black hover:shadow-lg hover:shadow-gold/40'
              : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
        >
          {isWin ? '🎮 Играть снова' : '🔄 Попробовать ещё'}
        </button>
      </div>
    </div>
  );
};
