import { motion, AnimatePresence } from 'framer-motion'
import { SPRING_SNAPPY } from './hooks.ts'

// ─── Types ───────────────────────────────────────────────────────────────

export type BannerPosition = 'top' | 'bottom'
export type BannerStyle = 'neutral' | 'warning' | 'victory' | 'defeat'

export interface PhaseBannerProps {
  /** Text to display (e.g. "YOUR TURN", "VICTORY"). */
  text: string
  /** Whether the banner is visible. */
  visible: boolean
  /** Position on screen. */
  position?: BannerPosition
  /** Style variant for colour theming. */
  style?: BannerStyle
  /** Auto-dismiss duration in ms (0 = no auto-dismiss). */
  autoDismissMs?: number
  /** Called when auto-dismiss fires or user clicks dismiss. */
  onDismiss?: () => void
  /** Additional sub-text. */
  subtitle?: string
}

// ─── Style map ───────────────────────────────────────────────────────────

const STYLES: Record<
  BannerStyle,
  { border: string; bg: string; text: string; accent: string }
> = {
  neutral: {
    border: 'border-gold/30',
    bg: 'from-gold/10 to-gold/5',
    text: 'text-gold',
    accent: '#ffd700',
  },
  warning: {
    border: 'border-red-500/30',
    bg: 'from-red-500/10 to-red-500/5',
    text: 'text-red-400',
    accent: '#ef4444',
  },
  victory: {
    border: 'border-green-500/30',
    bg: 'from-green-500/10 to-green-500/5',
    text: 'text-green-400',
    accent: '#22c55e',
  },
  defeat: {
    border: 'border-red-600/40',
    bg: 'from-red-600/15 to-red-600/5',
    text: 'text-red-300',
    accent: '#dc2626',
  },
}

// ─── Variants ────────────────────────────────────────────────────────────

const bannerVariants = {
  hidden: (pos: BannerPosition) => ({
    opacity: 0,
    y: pos === 'top' ? -80 : 80,
    scale: 0.9,
  }),
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: SPRING_SNAPPY,
  },
  exit: (pos: BannerPosition) => ({
    opacity: 0,
    y: pos === 'top' ? -60 : 60,
    scale: 0.85,
    transition: { duration: 0.25, ease: 'easeIn' as const },
  }),
} as const

// ─── Component ───────────────────────────────────────────────────────────

/**
 * An animated phase banner that slides in from the top or bottom of the
 * game board. Supports auto-dismiss and multiple style variants.
 *
 * Use it to announce turn changes, victory/defeat, or critical game events.
 */
export function PhaseBanner({
  text,
  visible,
  position = 'top',
  style: styleName = 'neutral',
  autoDismissMs = 0,
  onDismiss,
  subtitle,
}: PhaseBannerProps) {
  const styles = STYLES[styleName]

  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          key={`banner-${text}-${position}`}
          custom={position}
          variants={bannerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onAnimationComplete={() => {
            if (autoDismissMs > 0 && onDismiss) {
              setTimeout(onDismiss, autoDismissMs)
            }
          }}
          className={`pointer-events-none fixed inset-x-0 z-50 flex justify-center ${
            position === 'top' ? 'top-12' : 'bottom-12'
          }`}
        >
          <div
            className={`pointer-events-auto inline-flex flex-col items-center rounded-2xl border bg-gradient-to-br px-10 py-5 shadow-2xl backdrop-blur-xl ${styles.border} ${styles.bg}`}
            style={{
              boxShadow: `0 0 40px ${styles.accent}20, 0 8px 32px rgba(0,0,0,0.4)`,
            }}
          >
            <span
              className={`font-game text-3xl font-bold uppercase tracking-[0.15em] ${styles.text}`}
              style={{
                textShadow: `0 0 20px ${styles.accent}40`,
              }}
            >
              {text}
            </span>
            {subtitle && (
              <span className="mt-1 text-sm tracking-wider text-white/50">
                {subtitle}
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
