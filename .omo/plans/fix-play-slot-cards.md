# Plan: fix-play-slot-cards

## TL;DR (For humans)
Корень: при < 5 картах `findBestHand()` падает, `setPlayingCards` не вызывается, карты не долетают до центра.  
Надо: (1) защитить `handlePlayCards`, (2) починить кнопку Play — требовать 5 карт.

---

## Todo: GameBoard.tsx

### [x] Todo 1: Guard handlePlayCards + try/catch

- **File**: `src/ui/animations/GameBoard.tsx`
- **What**: Change early return from `selectedCardIds.length === 0` to `< 5`. Wrap `findBestHand` + `calculateDamage` in try/catch with `return` on error.
- **Exact old → new**:

```
-    if (selectedCardIds.length === 0) return
+    if (selectedCardIds.length < 5) return
```

After `const cardsToPlay = ...` at line 174, add another guard:
```
+    if (cardsToPlay.length < 5) return
```

Replace lines 178–189 (findBestHand + calculateDamage) with try/catch:
```
-    const evaluation = findBestHand(cardsToPlay)
-    const result = calculateDamage(...)
+    let evaluation, result
+    try {
+      evaluation = findBestHand(cardsToPlay)
+      result = calculateDamage(cardsToPlay, {...}, {...})
+    } catch {
+      return
+    }
```

- **Acceptance**: Selecting < 5 cards and pressing Play does nothing (no crash, no console error). Selecting 5+ cards works as before.
- **QA**: 
  - `npx tsc -b` — 0 errors
  - `npx vitest run` — all 165 tests pass  
  - Manual: select 3 cards → press Play → nothing crashes, button stays active but no state change
  - Manual: select 5 cards → press Play → cards animate to center

### Todo 2: Fix Play button disabled condition

- **File**: `src/ui/animations/GameBoard.tsx` line 779-781
- **What**: Change the disabled prop to require 5+ cards:
```
-    disabled={
-      selectedCardIds.length === 0 ||
-      gamePhase !== 'playing'
-    }
+    disabled={
+      selectedCardIds.length < 5 ||
+      gamePhase !== 'playing'
+    }
```
- **Acceptance**: Button is greyed out when < 5 cards selected, active when ≥ 5.
- **QA**: Visual check in browser — select 2 cards, button stays disabled; select 5, button lights up.

### Todo 3: Fix Play button label

- **File**: `src/ui/animations/GameBoard.tsx` line 799
- **What**: Show "Play (N)" only when ≥ 5, otherwise show "Select 5 cards":
```
-                Play ({selectedCardIds.length})
+                {selectedCardIds.length >= 5 ? `Play (${selectedCardIds.length})` : 'Select 5 cards'}
```
- **Acceptance**: When < 5 selected, button text reads "Select 5 cards". When ≥ 5, reads "Play (5)" etc.
- **QA**: Visual check in browser.

---

## Dependency Matrix
- Todos 1, 2, 3 are independent (same file, different locations)
- Order: 2+3 first (UI), then 1 (logic) — cosmetic but logical

## Post-Plan Verification
1. `npx tsc -b` — clean
2. `npx vitest run` — 165 pass
3. Manual: open `http://127.0.0.1:5173`, select 1-4 cards → button disabled, text "Select 5 cards"
4. Manual: select 5 cards → click Play → cards fly to center slots, damage shown
