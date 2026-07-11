export { AnimatedCard } from './AnimatedCard.tsx'
export type { AnimatedCardProps, CardAnimVariant } from './AnimatedCard.tsx'

export { DamageNumbers } from './DamageNumber.tsx'
export type { DamageEvent, DamageNumberProps } from './DamageNumber.tsx'

export { PhaseBanner } from './PhaseBanner.tsx'
export type { PhaseBannerProps, BannerPosition, BannerStyle } from './PhaseBanner.tsx'

export { DeckArea } from './DeckArea.tsx'
export type { DealAnimationState, DeckAreaProps } from './DeckArea.tsx'

export { PlaySlot } from './PlaySlot.tsx'
export type { PlaySlotCard, PlaySlotProps } from './PlaySlot.tsx'

export { DiscardPile } from './DiscardPile.tsx'
export type { DiscardPileProps } from './DiscardPile.tsx'

export { GameBoard } from './GameBoard.tsx'

export {
  useStaggeredDelay,
  useScreenShake,
  useAnimationSequence,
  SPRING_BOUNCE,
  SPRING_GENTLE,
  SPRING_SNAPPY,
} from './hooks.ts'
export type { AnimPhase } from './hooks.ts'
