import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useScreenShake } from './hooks.ts'

// ─── Types ───────────────────────────────────────────────────────────────

export interface DamageEvent {
  id: string
  /** Raw damage amount shown. */
  amount: number
  /** Target position on screen (client coords or CSS %). */
  x: number
  y: number
  /** Whether this is a critical hit (larger text, screen shake). */
  critical: boolean
  /** Type label like 'crit', 'shield', 'heal'. */
  label?: string
  /** Colour override. */
  color?: string
}

export interface DamageNumberProps {
  events: DamageEvent[]
  /** Optional padding to prevent clamping at edges. */
  padding?: number
}

// ─── Individual damage number animation ──────────────────────────────────

function DamageParticle({ event }: { event: DamageEvent }) {
  const fontSize = event.critical ? 48 : event.label ? 22 : 28
  const color = event.color ?? (event.critical ? '#ffd700' : '#ef4444')
  const label = event.critical
    ? 'CRIT!'
    : event.label ?? ''

  return (
    <motion.div
      key={event.id}
      initial={{
        opacity: 1,
        scale: event.critical ? 0.5 : 0.8,
        y: event.y,
        x: event.x,
      }}
      animate={{
        opacity: 0,
        scale: event.critical ? 1.3 : 1,
        y: event.y - (event.critical ? 120 : 80),
        x: event.x + (Math.random() - 0.5) * 40,
      }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{
        duration: event.critical ? 1.2 : 0.9,
        ease: 'easeOut',
      }}
      className="pointer-events-none absolute z-50"
      style={{ left: 0, top: 0 }}
    >
      {/* CRIT label */}
      {label && (
        <div
          className="mb-1 text-center font-bold uppercase tracking-widest"
          style={{
            fontSize: event.critical ? 18 : 12,
            color,
            textShadow: `0 0 12px ${color}80, 0 2px 4px rgba(0,0,0,0.5)`,
          }}
        >
          {label}
        </div>
      )}
      {/* Damage amount */}
      <div
        className="text-center font-bold"
        style={{
          fontSize,
          color,
          textShadow:
            `0 0 20px ${color}60, ` +
            `0 0 40px ${color}30, ` +
            `0 2px 4px rgba(0,0,0,0.5)`,
          fontFamily: "'Georgia', 'Times New Roman', serif",
          lineHeight: 1,
        }}
      >
        {event.critical ? `✧ ${event.amount} ✧` : `-${event.amount}`}
      </div>
    </motion.div>
  )
}

// ─── Screen shake overlay ────────────────────────────────────────────────

function ShakeOverlay({ active, intensity }: { active: boolean; intensity: number }) {
  const offset = useScreenShake(active, intensity, 400)

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-40"
      style={{
        x: offset.x,
        y: offset.y,
      }}
    />
  )
}

// ─── Container ───────────────────────────────────────────────────────────

/**
 * Renders floating damage numbers and a screen-shake overlay triggered
 * by critical-hit events.
 *
 * Place this component once at the board level; feed it `DamageEvent[]`
 * from the game store or animation orchestrator.
 */
export function DamageNumbers({ events, padding = 40 }: DamageNumberProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const hasCrit = events.some((e) => e.critical)

  return (
    <div ref={containerRef} className="relative" style={{ padding }}>
      <AnimatePresence>
        {events.map((event) => (
          <DamageParticle key={event.id} event={event} />
        ))}
      </AnimatePresence>

      {/* Screen shake on any critical hit */}
      <ShakeOverlay active={hasCrit} intensity={hasCrit ? 6 : 0} />
    </div>
  )
}
