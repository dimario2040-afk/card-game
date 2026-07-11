import { type ReactNode, useCallback, useRef } from 'react'
import { motion, type Variants, type HTMLMotionProps } from 'framer-motion'
import type { Card } from '@/types'
import { SPRING_BOUNCE, SPRING_SNAPPY } from './hooks.ts'

// ─── Types ───────────────────────────────────────────────────────────────

export type CardAnimVariant =
  | 'idle'
  | 'deal'
  | 'hover'
  | 'selected'
  | 'play'
  | 'discard'
  | 'hidden'

export interface AnimatedCardProps {
  /** The card data model. */
  card: Card
  /** Current animation variant to display. */
  variant: CardAnimVariant
  /** Delay in seconds before the animation starts (for staggering). */
  delay?: number
  /** Callback when the card mount animation completes. */
  onAnimationComplete?: () => void
  /** Called when the card is clicked. */
  onClick?: () => void
  /** Whether the card is interactive. */
  disabled?: boolean
  /** Custom class name for the card wrapper. */
  className?: string
  /** Content to render inside the card. If omitted renders a default face. */
  children?: ReactNode
  /** LayoutId for shared layout animations (e.g. hand → play slot). */
  layoutId?: string
  /** Additional Framer Motion props forwarded to the motion.div. */
  motionProps?: HTMLMotionProps<'div'>
}

// ─── Variants ────────────────────────────────────────────────────────────

/**
 * Only GPU-composited properties are animated: transform (translate, scale,
 * rotate), opacity, and filter. No layout-thrashing properties (width, height,
 * top, left, margin, padding) in animation targets — those stay in Tailwind
 * className or style only.
 */
const cardVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.6,
    y: 60,
    rotateX: 90,
    pointerEvents: 'none',
  },
  deal: {
    opacity: 1,
    scale: 1,
    y: 0,
    rotateX: 0,
    transition: {
      ...SPRING_BOUNCE,
      delay: 0,
    },
  },
  idle: {
    opacity: 1,
    scale: 1,
    y: 0,
    rotateX: 0,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
  hover: {
    y: -12,
    scale: 1.04,
    filter: 'brightness(1.15)',
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  selected: {
    scale: 1.05,
    y: -8,
    borderColor: 'rgba(255,215,0,0.8)',
    boxShadow: '0 0 20px rgba(255,215,0,0.4)',
    transition: { duration: 0.25, ease: 'easeOut' },
  },
  play: {
    opacity: 1,
    scale: 1.08,
    y: -180,
    x: 0,
    rotate: 0,
    rotateX: 0,
    filter: 'brightness(1.3)',
    transition: {
      ...SPRING_SNAPPY,
      delay: 0,
    },
  },
  discard: {
    opacity: 0,
    scale: 0.4,
    y: 120,
    x: 80,
    rotate: 15,
    transition: {
      duration: 0.4,
      ease: 'easeIn',
      delay: 0,
    },
  },
}

// ─── Suit helpers ────────────────────────────────────────────────────────

const SUIT_SYMBOL: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}
const SUIT_COLOR: Record<string, string> = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-white',
  spades: 'text-white',
}

function suitInfo(suit: string) {
  return {
    symbol: SUIT_SYMBOL[suit.toLowerCase()] ?? '?',
    color: SUIT_COLOR[suit.toLowerCase()] ?? 'text-gray-400',
  }
}

// ─── Default card face ───────────────────────────────────────────────────

function DefaultCardFace({ card }: { card: Card }) {
  const { symbol, color } = suitInfo(card.suit)
  return (
    <div className="flex h-full flex-col">
      {/* Top-left corner */}
      <div className="absolute left-2 top-2 flex flex-col items-center leading-none">
        <span className={`font-game text-lg font-bold ${color}`}>
          {card.rank}
        </span>
        <span className={`text-sm leading-none ${color}`}>{symbol}</span>
      </div>
      {/* Center suit */}
      <div className="flex flex-1 items-center justify-center">
        <span className={`text-3xl ${color}`}>{symbol}</span>
      </div>
      {/* Bottom-right inverted corner */}
      <div className="absolute bottom-2 right-2 flex rotate-180 flex-col items-center leading-none">
        <span className={`font-game text-lg font-bold ${color}`}>
          {card.rank}
        </span>
        <span className={`text-sm leading-none ${color}`}>{symbol}</span>
      </div>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────

export function AnimatedCard({
  card,
  variant,
  delay = 0,
  onAnimationComplete,
  onClick,
  disabled = false,
  className = '',
  children,
  layoutId,
  motionProps,
}: AnimatedCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  const handleAnimationComplete = useCallback(() => {
    onAnimationComplete?.()
  }, [onAnimationComplete])

  return (
    <motion.div
      ref={ref}
      layoutId={layoutId}
      variants={cardVariants}
      initial="hidden"
      animate={variant}
      exit="hidden"
      whileHover={disabled || variant !== 'idle' ? undefined : 'hover'}
      whileTap={disabled || variant !== 'idle' ? undefined : { scale: 0.96 }}
      onAnimationComplete={handleAnimationComplete}
      onClick={disabled ? undefined : onClick}
      className={
        `relative h-36 w-26 cursor-default select-none rounded-xl border-2 border-white/15 ` +
        `bg-gradient-to-br from-white/10 to-white/5 p-2 shadow-lg backdrop-blur-sm ` +
        `will-change-transform ` +
        (disabled ? 'opacity-50' : 'cursor-pointer') +
        ` ${className}`
      }
      {...motionProps}
      transition={{
        delay,
        ...(motionProps?.transition ?? {}),
      }}
    >
      {children ?? <DefaultCardFace card={card} />}
    </motion.div>
  )
}
