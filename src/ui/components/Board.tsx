import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/store/game-store'
import { CardHand } from './CardHand'
import type { Card } from '@/types'

// ─── SVG ViewBox constants ──────────────────────────────────────────────

const VB_W = 1200
const VB_H = 800
const R = 8 // corner radius

// Layout zones
const ZONE_ENEMY_INFO = 20
const ZONE_ENEMY_BOARD = 110
const ZONE_CENTER = 330
const ZONE_PLAYER_BOARD = 540
const ZONE_PLAYER_INFO = 720
// HP bar
const HP_X = 200
const HP_W = 340
const HP_H = 22
const HP_Y_PLAYER = ZONE_PLAYER_INFO + 6
const HP_Y_ENEMY = ZONE_ENEMY_INFO + 6

// Mana crystals
const MANA_X = 850
const MANA_R = 10
const MANA_GAP = 6
const MANA_Y_PLAYER = ZONE_PLAYER_INFO + 6
const MANA_Y_ENEMY = ZONE_ENEMY_INFO + 6

// Board card slots
const SLOT_W = 88
const SLOT_H = 128
const SLOT_GAP = 10
const BOARD_SLOTS = 5
const CENTER_SLOTS = 3

// ─── Coordinate helpers ─────────────────────────────────────────────────

function centerSlotsX(
  count: number,
  index: number,
  slotW: number,
  gap: number,
): number {
  const totalW = count * slotW + (count - 1) * gap
  return (VB_W - totalW) / 2 + index * (slotW + gap)
}

function diamond(cx: number, cy: number, r: number): string {
  return `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`
}

function pctX(x: number): string {
  return `${(x / VB_W) * 100}%`
}
function pctY(y: number): string {
  return `${(y / VB_H) * 100}%`
}
function pctW(w: number): string {
  return `${(w / VB_W) * 100}%`
}

// ─── HP bar color ───────────────────────────────────────────────────────

function hpColor(ratio: number): string {
  if (ratio > 0.6) return '#22c55e'
  if (ratio > 0.3) return '#eab308'
  return '#ef4444'
}

// ─── Sub-components ─────────────────────────────────────────────────────

interface HpBarProps {
  x: number
  y: number
  w: number
  h: number
  current: number
  max: number
}

function HpBar({ x, y, w, h, current, max }: HpBarProps) {
  const ratio = Math.max(0, Math.min(1, current / max))
  const color = hpColor(ratio)
  const r = h / 2

  return (
    <g>
      {/* Background track */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={r}
        fill="rgba(0,0,0,0.45)"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={1}
      />
      {/* Animated fill */}
      <motion.rect
        x={x}
        y={y}
        width={ratio * w}
        height={h}
        rx={r}
        fill={color}
        initial={false}
        animate={{ width: ratio * w }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
      {/* Inner highlight */}
      <rect
        x={x + 4}
        y={y + 3}
        width={Math.max(0, ratio * w - 8)}
        height={h / 3}
        rx={2}
        fill="rgba(255,255,255,0.15)"
      />
      {/* Label */}
      <text
        x={x + w / 2}
        y={y + h / 2 + 1}
        fill="white"
        fontSize={13}
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontFamily: 'Georgia, serif', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
      >
        {current} / {max}
      </text>
    </g>
  )
}

interface ManaCrystalsProps {
  x: number
  y: number
  current: number
  max: number
  r?: number
}

function ManaCrystals({
  x,
  y,
  current,
  max,
  r = MANA_R,
}: ManaCrystalsProps) {
  return (
    <g>
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < current
        return (
          <motion.polygon
            key={`mana-${i}`}
            points={diamond(x + i * (r * 2 + MANA_GAP), y + r, r)}
            fill={filled ? '#a78bfa' : '#374151'}
            initial={false}
            animate={{
              fill: filled ? '#a78bfa' : '#374151',
              opacity: filled ? 1 : 0.35,
              scale: filled ? 1 : 0.85,
            }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            filter={filled ? 'url(#mana-glow)' : undefined}
          />
        )
      })}
    </g>
  )
}

interface BoardSlotProps {
  x: number
  y: number
  w: number
  h: number
  index: number
  type: 'enemy' | 'player' | 'center'
  children?: React.ReactNode
}

function BoardSlot({
  x,
  y,
  w,
  h,
  index,
  type,
  children,
}: BoardSlotProps) {
  const borderColor =
    type === 'center'
      ? 'rgba(255,215,0,0.18)'
      : 'rgba(255,255,255,0.08)'
  const fillColor =
    type === 'center'
      ? 'rgba(255,215,0,0.03)'
      : 'rgba(255,255,255,0.02)'

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={R}
        fill={fillColor}
        stroke={borderColor}
        strokeWidth={1.5}
        strokeDasharray="5,4"
      />
      {/* Index number (subtle) */}
      <text
        x={x + w / 2}
        y={y + h / 2 + 1}
        fill="rgba(255,255,255,0.06)"
        fontSize={11}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        {index + 1}
      </text>
      {children}
    </g>
  )
}

// ─── Main Board Component ───────────────────────────────────────────────

export function Board() {
  const player = useGameStore((s) => s.player)
  const enemy = useGameStore((s) => s.enemy)
  const gamePhase = useGameStore((s) => s.gamePhase)
  const turn = useGameStore((s) => s.turn)
  const selectedCardIds = useGameStore((s) => s.selectedCardIds)

  // Cards selected for play — appear in center slots
  const selectedCards: Card[] = player.hand.filter((c) =>
    selectedCardIds.includes(c.id),
  )

  return (
    <div className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
      {/* SVG Board Layer */}
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="block h-auto w-full"
        style={{ aspectRatio: `${VB_W}/${VB_H}` }}
      >
        <defs>
          {/* Board background — radial felt green */}
          <radialGradient id="board-bg" cx="50%" cy="50%" r="75%">
            <stop offset="0%" stopColor="#1a6b3c" />
            <stop offset="55%" stopColor="#125230" />
            <stop offset="100%" stopColor="#08301a" />
          </radialGradient>

          {/* Center subtle glow */}
          <radialGradient id="center-glow" cx="50%" cy="50%" r="45%">
            <stop offset="0%" stopColor="rgba(255,215,0,0.07)" />
            <stop offset="100%" stopColor="rgba(255,215,0,0)" />
          </radialGradient>

          {/* Mana crystal glow */}
          <filter id="mana-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Drop shadow for crystals */}
          <filter id="crystal-shadow">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="rgba(0,0,0,0.4)" />
          </filter>
        </defs>

        {/* ── Background ── */}
        <rect width={VB_W} height={VB_H} fill="url(#board-bg)" />
        <rect width={VB_W} height={VB_H} fill="url(#center-glow)" />

        {/* Felt cloth texture — faint crosshatch lines */}
        {Array.from({ length: 48 }).map((_, i) => (
          <line
            key={`v${i}`}
            x1={i * 25}
            y1={0}
            x2={i * 25}
            y2={VB_H}
            stroke="rgba(255,255,255,0.012)"
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: 32 }).map((_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={i * 25}
            x2={VB_W}
            y2={i * 25}
            stroke="rgba(255,255,255,0.012)"
            strokeWidth={1}
          />
        ))}

        {/* ── Border frame ── */}
        <rect
          x={15}
          y={15}
          width={VB_W - 30}
          height={VB_H - 30}
          rx={14}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={2}
        />

        {/* ── Battlefield divider ── */}
        <line
          x1={60}
          y1={VB_H / 2}
          x2={VB_W - 60}
          y2={VB_H / 2}
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={2}
          strokeDasharray="12,8"
        />

        {/* Center turn / phase indicator */}
        <text
          x={VB_W / 2}
          y={VB_H / 2 - 18}
          fill="rgba(255,215,0,0.25)"
          fontSize={14}
          textAnchor="middle"
          style={{ fontFamily: 'Georgia, serif', letterSpacing: '4px' }}
        >
          TURN {turn}
        </text>
        <text
          x={VB_W / 2}
          y={VB_H / 2 + 20}
          fill="rgba(255,255,255,0.12)"
          fontSize={10}
          textAnchor="middle"
          style={{ fontFamily: 'Georgia, serif', letterSpacing: '3px' }}
        >
          {gamePhase.toUpperCase()}
        </text>

        {/* ════════════════ ENEMY SECTION ════════════════ */}

        {/* Enemy label */}
        <text
          x={50}
          y={ZONE_ENEMY_INFO + 10}
          fill="rgba(255,255,255,0.35)"
          fontSize={10}
          textAnchor="start"
          style={{ fontFamily: 'Georgia, serif', letterSpacing: '3px' }}
        >
          ENEMY
        </text>

        {/* Enemy name */}
        <text
          x={50}
          y={ZONE_ENEMY_INFO + 34}
          fill="white"
          fontSize={18}
          fontWeight="bold"
          style={{ fontFamily: 'Georgia, serif' }}
        >
          {enemy.name}
        </text>

        {/* Enemy HP bar */}
        <HpBar
          x={HP_X}
          y={HP_Y_ENEMY}
          w={HP_W}
          h={HP_H}
          current={enemy.health}
          max={enemy.maxHealth}
        />

        {/* Enemy shield indicator */}
        {enemy.shield > 0 && (
          <g>
            <rect
              x={HP_X + HP_W + 10}
              y={HP_Y_ENEMY}
              width={64}
              height={HP_H}
              rx={HP_H / 2}
              fill="rgba(96,165,250,0.25)"
              stroke="rgba(96,165,250,0.5)"
              strokeWidth={1.5}
            />
            <text
              x={HP_X + HP_W + 10 + 32}
              y={HP_Y_ENEMY + HP_H / 2 + 1}
              fill="white"
              fontSize={12}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              ✦ {enemy.shield}
            </text>
          </g>
        )}

        {/* Enemy mana crystals */}
        <ManaCrystals
          x={MANA_X}
          y={MANA_Y_ENEMY}
          current={enemy.mana}
          max={enemy.maxMana}
        />

        {/* Enemy board card slots */}
        {Array.from({ length: BOARD_SLOTS }).map((_, i) => (
          <BoardSlot
            key={`eslot-${i}`}
            x={centerSlotsX(BOARD_SLOTS, i, SLOT_W, SLOT_GAP)}
            y={ZONE_ENEMY_BOARD}
            w={SLOT_W}
            h={SLOT_H}
            index={i}
            type="enemy"
          />
        ))}

        {/* ════════════════ CENTER PLAY SLOTS ════════════════ */}

        {Array.from({ length: CENTER_SLOTS }).map((_, i) => (
          <BoardSlot
            key={`cslot-${i}`}
            x={centerSlotsX(CENTER_SLOTS, i, SLOT_W, SLOT_GAP)}
            y={ZONE_CENTER}
            w={SLOT_W}
            h={SLOT_H}
            index={i}
            type="center"
          />
        ))}

        {/* Center label */}
        <text
          x={VB_W / 2}
          y={ZONE_CENTER + SLOT_H + 28}
          fill="rgba(255,215,0,0.15)"
          fontSize={10}
          textAnchor="middle"
          style={{ fontFamily: 'Georgia, serif', letterSpacing: '4px' }}
        >
          BATTLEFIELD
        </text>

        {/* ════════════════ PLAYER SECTION ════════════════ */}

        {/* Player board card slots */}
        {Array.from({ length: BOARD_SLOTS }).map((_, i) => (
          <BoardSlot
            key={`pslot-${i}`}
            x={centerSlotsX(BOARD_SLOTS, i, SLOT_W, SLOT_GAP)}
            y={ZONE_PLAYER_BOARD}
            w={SLOT_W}
            h={SLOT_H}
            index={i}
            type="player"
          />
        ))}

        {/* Player HP bar */}
        <HpBar
          x={HP_X}
          y={HP_Y_PLAYER}
          w={HP_W}
          h={HP_H}
          current={player.health}
          max={player.maxHealth}
        />

        {/* Player shield indicator */}
        {player.shield > 0 && (
          <g>
            <rect
              x={HP_X + HP_W + 10}
              y={HP_Y_PLAYER}
              width={64}
              height={HP_H}
              rx={HP_H / 2}
              fill="rgba(96,165,250,0.25)"
              stroke="rgba(96,165,250,0.5)"
              strokeWidth={1.5}
            />
            <text
              x={HP_X + HP_W + 10 + 32}
              y={HP_Y_PLAYER + HP_H / 2 + 1}
              fill="white"
              fontSize={12}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              ✦ {player.shield}
            </text>
          </g>
        )}

        {/* Player mana crystals */}
        <ManaCrystals
          x={MANA_X}
          y={MANA_Y_PLAYER}
          current={player.mana}
          max={player.maxMana}
        />

        {/* Player label */}
        <text
          x={50}
          y={ZONE_PLAYER_INFO + 10}
          fill="rgba(255,255,255,0.35)"
          fontSize={10}
          textAnchor="start"
          style={{ fontFamily: 'Georgia, serif', letterSpacing: '3px' }}
        >
          PLAYER
        </text>

        {/* Player name */}
        <text
          x={50}
          y={ZONE_PLAYER_INFO + 34}
          fill="white"
          fontSize={18}
          fontWeight="bold"
          style={{ fontFamily: 'Georgia, serif' }}
        >
          {player.name}
        </text>

        {/* ════════════════ PLAYED CARDS (selected → center) ════════════════ */}

        <AnimatePresence>
          {selectedCards.map((card, i) => {
            if (i >= CENTER_SLOTS) return null
            const cx = centerSlotsX(CENTER_SLOTS, i, SLOT_W, SLOT_GAP)
            return (
              <motion.g
                key={`played-${card.id}`}
                layoutId={`card-${card.id}`}
                initial={{ opacity: 0, y: 120, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              >
                {/* Card visual within SVG (simplified) */}
                <rect
                  x={cx + 4}
                  y={ZONE_CENTER + 4}
                  width={SLOT_W - 8}
                  height={SLOT_H - 8}
                  rx={6}
                  fill="rgba(255,255,255,0.1)"
                  stroke="rgba(255,215,0,0.4)"
                  strokeWidth={1.5}
                />
                <text
                  x={cx + SLOT_W / 2}
                  y={ZONE_CENTER + SLOT_H / 2 + 1}
                  fill="rgba(255,215,0,0.7)"
                  fontSize={11}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ fontFamily: 'Georgia, serif' }}
                >
                  {card.rank} {card.suit}
                </text>
              </motion.g>
            )
          })}
        </AnimatePresence>
      </svg>

      {/* ════════════════ HTML Overlay — Card Hands ════════════════ */}

      {/* Player hand — sits below player board slots */}
      <div
        className="absolute flex justify-center"
        style={{
          left: pctX(0),
          top: pctY(ZONE_PLAYER_BOARD + SLOT_H + 20),
          width: pctW(VB_W),
        }}
      >
        <CardHand cards={player.hand} label="Your Hand" />
      </div>

      {/* Enemy hand (face down) — sits above enemy board slots */}
      <div
        className="absolute flex justify-center"
        style={{
          left: pctX(0),
          top: pctY(5),
          width: pctW(VB_W),
        }}
      >
        <CardHand cards={enemy.hand} faceUp={false} label="Enemy Hand" />
      </div>
    </div>
  )
}
