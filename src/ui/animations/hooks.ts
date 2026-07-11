import { useCallback, useEffect, useRef, useState } from 'react'
import type { Spring } from 'framer-motion'
import { useAnimationFrame } from 'framer-motion'

// ─── Spring presets ───────────────────────────────────────────────────────

export const SPRING_BOUNCE: Spring = {
  stiffness: 300,
  damping: 22,
  mass: 0.8,
}

export const SPRING_GENTLE: Spring = {
  stiffness: 180,
  damping: 18,
  mass: 1,
}

export const SPRING_SNAPPY: Spring = {
  stiffness: 400,
  damping: 28,
  mass: 0.6,
}

// ─── useStaggeredDelay ───────────────────────────────────────────────────

/**
 * Returns a staggered delay (in seconds) for animating items in sequence.
 *
 * @param index     — zero-based position in the sequence.
 * @param baseDelay — initial offset before the sequence starts.
 * @param stepMs    — milliseconds between each item's start.
 */
export function useStaggeredDelay(
  index: number,
  baseDelay = 0,
  stepMs = 60,
): number {
  return baseDelay + index * (stepMs / 1000)
}

// ─── useScreenShake ──────────────────────────────────────────────────────

interface ShakeState {
  x: number
  y: number
}

/**
 * Returns a `ShakeState` that oscillates randomly for `durationMs`
 * whenever `trigger` flips to `true`. Set `intensity` for big hits.
 */
export function useScreenShake(
  trigger: boolean,
  intensity = 4,
  durationMs = 400,
): ShakeState {
  const [offset, setOffset] = useState<ShakeState>({ x: 0, y: 0 })
  const elapsedRef = useRef(0)
  const activeRef = useRef(false)

  useEffect(() => {
    if (trigger) {
      elapsedRef.current = 0
      activeRef.current = true
    }
  }, [trigger])

  useAnimationFrame((_, delta) => {
    if (!activeRef.current) return
    elapsedRef.current += delta
    if (elapsedRef.current >= durationMs) {
      activeRef.current = false
      setOffset({ x: 0, y: 0 })
      return
    }

    const decay = 1 - elapsedRef.current / durationMs
    setOffset({
      x: (Math.random() - 0.5) * 2 * intensity * decay,
      y: (Math.random() - 0.5) * 2 * intensity * decay,
    })
  })

  return offset
}

// ─── useAnimationSequence ────────────────────────────────────────────────

type AnimPhase = 'idle' | 'dealing' | 'playing' | 'discarding'

/**
 * Tracks the current phase of an animation sequence for a set of cards.
 * Call `start('dealing')` to transition; the state machine auto-advances
 * through `dealing -> playing -> discarding -> idle`.
 */
export function useAnimationSequence() {
  const [phase, setPhase] = useState<AnimPhase>('idle')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const start = useCallback(
    (from: AnimPhase = 'dealing') => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setPhase(from)
    },
    [],
  )

  const advance = useCallback(() => {
    setPhase((prev) => {
      const next: Record<AnimPhase, AnimPhase> = {
        idle: 'idle',
        dealing: 'playing',
        playing: 'discarding',
        discarding: 'idle',
      }
      return next[prev]
    })
  }, [])

  const reset = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setPhase('idle')
  }, [])

  // Auto-advance through phases with a pause between each
  useEffect(() => {
    if (phase === 'idle') return
    const delay =
      phase === 'dealing' ? 1200 : phase === 'playing' ? 800 : 600
    timeoutRef.current = setTimeout(advance, delay)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [phase, advance])

  return { phase, start, advance, reset } as const
}

export type { AnimPhase }
