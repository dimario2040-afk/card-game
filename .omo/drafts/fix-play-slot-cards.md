# Draft: fix-play-slot-cards

## Intent
**CLEAR**, review_required: false  
The user wants cards to visually appear in the center play slots after clicking Play. Currently nothing happens.

## Root Cause (diagnosed)
1. `handlePlayCards` in `GameBoard.tsx` calls `findBestHand(cardsToPlay)` at line 179
2. `findBestHand()` throws `Error("At least 5 cards required")` if `cards.length < 5`
3. The throw prevents ALL code after it from executing — `setPlayingCards` is never called
4. Therefore `<PlaySlot>` never receives cards → nothing renders in center
5. Additionally, the Play button is enabled at `selectedCardIds.length > 0` (misleading)

## Already Done
- **PlaySlot.tsx** — Rewritten from global-absolute-overlay to per-slot `position: relative` containers (each slot is self-contained, card renders as `absolute inset-0` inside its slot frame). This was a pre-existing positioning bug but not the root cause of "cards don't appear".

## Changes Required (in GameBoard.tsx)

### Change 1: Guard `handlePlayCards` against < 5 cards + try/catch
- Change early return from `selectedCardIds.length === 0` to `< 5`
- Wrap `findBestHand` + `calculateDamage` in try/catch

### Change 2: Fix Play button disabled condition
- Change `selectedCardIds.length === 0` to `selectedCardIds.length < 5`

### Change 3: Fix Play button label
- Show "Play (N)" only when ≥ 5 selected, otherwise "Select 5 cards"

## Status
- [ ] awaiting-approval
- [ ] plan-written  
- [ ] implemented
- [ ] verified (build + tests + manual)
