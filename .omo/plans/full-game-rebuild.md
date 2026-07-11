# Plan: full-game-rebuild

## TL;DR (For humans)
Перестраиваем упрощённое демо в полноценную тактическую игру "Герои Покера и Магии: Дуэль" по полному ТЗ. 10 фаз, от доменной модели до интеграции.

---

## Phase 1: Core Domain Model & Unit Stats

### [ ] 1.1 — New types: Unit, FieldLine, DuelState, DraftSelection

- **File**: `src/types/game.ts` (rewrite)
- **What**: Define the new domain model:
```typescript
type UnitType = 'melee' | 'ranged' | 'flying' | 'spellcaster'
type Line = 'front' | 'back'

interface Unit {
  id: string
  cardId: string
  suit: string
  rank: string
  unitType: UnitType
  atk: number; def: number; hp: number; maxHp: number; spd: number
  line: Line; slot: number; owner: 'player' | 'enemy'
  alive: boolean
  hasActed: boolean
  damageDealtThisTurn?: number
}

interface FieldLine {
  front: (Unit | null)[]  // length 3
  back: (Unit | null)[]   // length 2
}

interface HeroCard {
  cardId: string; suit: string; rank: string
  leadershipBonus: number  // rank/2 (floor)
  factionSuit: string
}

interface DraftSelection {
  heroCard: Card | null
  unitCards: Card[]  // max 5
  handCards: Card[]  // remaining 4
}

interface DuelState {
  attackerId: string; defenderId: string
  phase: 'declare' | 'bet' | 'hand_select' | 'reveal' | 'result'
  chips: { attacker: number; defender: number; pot: number }
  attackerCards?: Card[]; defenderCards?: Card[]
  attackerHandRank?: number; defenderHandRank?: number
  damage?: number; counterDamage?: number
  result?: 'hit' | 'blocked' | 'tie'
}
```
- **Stateless conversion**: `cardToUnitStats(card: Card): UnitStats` in `src/game/unit-stats.ts`
  - ATK = card value (2-10, J=11, Q=12, K=13, A=14)
  - DEF = floor(value / 2)
  - HP by tier: 2-5→1, 6-9→2, 10-K→3, A→4
  - SPD = 15 - value
  - UnitType by suit: ♥=melee, ♦=ranged, ♣=flying, ♠=spellcaster
- **Acceptance**: All functions pure, no side effects. `cardToUnitStats({rank:'A',suit:'hearts'})` returns ATK=14, DEF=7, HP=4, SPD=1, type='melee'
- **QA**: `npx vitest run src/game/unit-stats.test.ts` — test all values, all suits, all ranks

### [ ] 1.2 — Entity state with field + chips

- **File**: `src/types/game.ts`
- **What**: Rewrite `EntityState` to include `field: FieldLine`, `chips: number`, `hero: HeroCard | null`. Update `GameState` with `phase: 'draft' | 'battle' | 'finished'`, `duel: DuelState | null`.
- **Acceptance**: New GameState serializable, backward-incompatible (intentional)

---

## Phase 2: Draft Logic

### [ ] 2.1 — Draft engine (pure functions)

- **File**: `src/game/draft.ts`
- **What**: 
  - `dealDraftHands(): { playerCards: Card[], enemyCards: Card[] }` — shuffle 52, deal 10 each
  - `confirmDraft(playerSelection: DraftSelection, enemySelection: DraftSelection): { playerField, enemyField, playerHand, enemyHand }` — deploy units, return starting state
  - Apply hero leadership bonus: +leadershipBonus to ATK and DEF
  - Apply faction bonus: hero suit matches unit suit → bonus
- **Acceptance**: 10 dealt → pick 1 hero + 5 units + 4 hand. Remaining cards discarded.
- **QA**: Test deck is 52, no dupes. Test hero bonus applied. Test faction bonus.

### [ ] 2.2 — Enemy draft AI

- **File**: `src/ai/draft-ai.ts`
- **What**: AI picks hero + units + arrangement. Prioritizes: high-value hero, suit synergy, balanced line.
- **Acceptance**: AI always returns valid DraftSelection.
- **QA**: 100 random draws, AI never throws, always picks exactly 1+5.

---

## Phase 3: Game Store

### [ ] 3.1 — Zustand store rewrite

- **File**: `src/store/game-store.ts` (rewrite)
- **What**: New store with:
  - `setPhase(phase)`, `initDraft()`, `selectDraftHero(cardId)`, `selectDraftUnit(cardId)`, `confirmDraft()`
  - `startBattle()` — deploy units, set initiative
  - `selectUnit(unitId)`, `declareAttack(defenderId)` — attack flow
  - `duelBet(action: 'fold'|'call'|'raise', amount?: number)`
  - `duelSelectCards(cardIds: string[])` — pick hand for duel
  - `resolveDuel()` — compare hands, apply damage
  - `endUnitTurn()`, `nextInitiative()`, `drawPhase()`, `reshuffleDiscard()`
  - `useSpell(spellId, targetId?)`, `endTurn()`
  - `checkWinCondition()` — all 5 units dead or surrender
- **Acceptance**: Actions are atomic, immer-immutable. Each action has tests.
- **QA**: Test each action independently. 50+ tests.

---

## Phase 4: Battle Loop

### [ ] 4.1 — Initiative & turn order

- **File**: `src/game/battle-loop.ts`
- **What**: 
  - `calculateInitiative(playerField, enemyField): Unit[]` — sort all alive units by SPD desc, ties by suit rank (♥>♦>♣>♠)
  - `getNextUnit(initiative: Unit[], actedIds: Set<string>): Unit | null`
  - `drawToHandSize(entity, targetSize=5)` — draw from deck, reshuffle discard if needed
- **Acceptance**: Returns correct order. Draw reshuffles when deck empty.
- **QA**: Test SPD ordering. Test reshuffle. Test draw to 5.

### [ ] 4.2 — Unit action resolution

- **File**: `src/game/battle-loop.ts` (extend)
- **What**: `executeUnitAction(unit, action, target, state): BattleResult`
  - Move: change slot position (melee=adjacent, ranged=adjacent, flying=any)
  - Attack: enter duel sub-phase
  - Spell: enter spell sub-phase
  - Pass: mark as acted
- **Acceptance**: Movement respects unit type restrictions. Attack starts duel.

---

## Phase 5: Combat Duel System

### [ ] 5.1 — Duel engine (pure)

- **File**: `src/game/duel-engine.ts`
- **What**: Full duel sub-phase:
  1. `declareAttack(attacker, defender): DuelState` — set initial state
  2. `resolveBet(duel, action, amount): DuelState` — fold/call/raise
     - Fold → `resolveFold(duel): DuelResult` — auto-hit, damage = ATK - DEF (min 1), no counter
  3. `resolveHands(duel, attackerCards, defenderCards): DuelState` — compare poker hands
     - Score = findBestHand(cards).score + ATK vs score + DEF
     - Higher wins → damage = difference (min 1 if attacker wins, 0 if defender wins)
     - Tie → damage = ATK - DEF (min 0)
  4. `checkCounterattack(duel): boolean` — if defender is melee/flying in front line and alive → counter
     - Counter damage = ATK_defender - DEF_attacker (min 1), no cards spent
  5. `resolveDuelResult(duel): DuelResult` — final damage, chip transfer, card discard

- **DuelResult**: `{ attackerDamage, defenderDamage, counterDamage, chipWinner, discardedCards, log }`
- **Acceptance**: All outcomes tested (fold, call, raise, counter, tie, all hand types)
- **QA**: 40+ tests covering every branch

---

## Phase 6: Spell System

### [ ] 6.1 — Spell engine

- **File**: `src/game/spells.ts`
- **What**: Spell catalog + resolution:
```typescript
interface Spell {
  id: string; name: string; cost: number; chipCost: number
  targetType: 'enemy_unit' | 'friendly_unit' | 'all_enemy' | 'self'
  effect(spell, caster, target, state): SpellResult
}
```
- Spells: MagicArrow (discard 1, 1 chip, dmg=discarded value), Lightning (pair, 2, 5 dmg), Haste (two pair, 2, +2 SPD + extra turn), StoneSkin (triple, 3, +3 DEF), Resurrection (full house, 4, revive 1 HP), Meteor (straight, 4, 2 AoE dmg)
- Discount for spade hero: -1 chip cost
- **Acceptance**: Spell only usable if player has required combo + chips. Effect applied correctly.
- **QA**: Test each spell effect. Test insufficient resources (rejected).

---

## Phase 7: AI Rewrite

### [ ] 7.1 — Battle AI

- **File**: `src/ai/battle-ai.ts`
- **What**: 
  - `decideDraftAction(hand): DraftSelection` — choose hero + units
  - `decideUnitAction(unit, field, enemyField, hand): UnitAction` — move/attack/spell/pass
    - Target priority: lowest HP enemy, highest threat (highest ATK), backline if possible
    - Spell usage: use when chip-efficient
  - `decideDuelAction(duelState, hand, chips, personality): DuelAction` — fold/call/raise
    - Hand strength evaluation: fold if weak hand (< pair), raise if strong (> flush)
    - Bluff chance: 15% for aggro, 5% balanced, 0% defensive
  - `decideSpellTarget(unit, enemyField, friendlyField): string`
- **3 personalities**: aggro (aggressive betting, frontline), balanced, defensive (conservative, backline spells)
- **Acceptance**: AI always returns valid action. No crashes. Personality affects decisions measurably.
- **QA**: 30+ tests with different scenarios, verify personality differences

---

## Phase 8: UI — Draft Screen

### [ ] 8.1 — DraftScreen component

- **File**: `src/ui/screens/DraftScreen.tsx`
- **What**: 
  - Shows 10 dealt cards in a row
  - Tap card to mark as hero (special border, only 1)
  - Tap 5 cards to deploy as units (checkmark overlay)
  - Front/back line arrangement: first 3 → front line, next 2 → back line (with drag to rearrange)
  - Unit stat preview (hover/tap): shows ATK/DEF/HP/SPD/type
  - Confirm button (active when 1 hero + 5 units selected)
  - Polish: Framer Motion card animations, suit-colored borders
- **Acceptance**: Player can select exactly 1 hero + 5 units. Confirm dispatches draft action.
- **QA**: Visual: npx tsc && npx vitest. Manual: open browser, verify flow.

---

## Phase 9: UI — Battlefield

### [ ] 9.1 — Battlefield component (main game screen)

- **File**: `src/ui/screens/Battlefield.tsx`
- **What**:
  - **Enemy field** (top): 2 lines, front (3 slots) + back (2 slots). Face-down cards (enemy hidden) or face-up.
  - **Center area**: initiative tracker, duel panel, spell panel
  - **Player field** (bottom): 2 lines, clickable units
  - **Unit card display**: type icon (⚔️🏹🐉🔮), ATK/DEF/HP/SPD bars
  - **Hand panel**: player's command hand (4+ cards), click to select for duels/spells
  - **Duel panel**: shows when duel is active — attacker → defender, bet/fold/call/raise buttons, chip count, hand selection area
  - **Spell panel**: shows when spade unit selected — available spells with requirements
  - **Chip display**: both players' chip counts
  - **Combat log**: scrollable log at bottom
  - **Turn indicator**: whose unit is acting
- **Unit action flow** (on unit click):
  1. Click own unit → highlight valid targets
  2. Click enemy → declare attack → duel panel opens
  3. Click empty slot → move (if allowed)
  4. Click spell button (spade only) → spell panel
- **Acceptance**: Full game playable through UI. All interactions have visual feedback.
- **QA**: Manual playthrough. npx tsc -b clean. npx vitest run passes.

### [ ] 9.2 — Duel UI

- **File**: src/ui/components/DuelPanel.tsx
- **What**: Betting interface: slider or buttons for chip amount, fold/call/raise buttons, hand card selection (tap 1-5 cards from hand), reveal animation (cards flip), result display (hit/blocked/counter)
- **Acceptance**: Complete duel flow in UI without console errors

---

## Phase 10: Integration & Polish

### [ ] 10.1 — App.tsx game flow

- **File**: `src/App.tsx`
- **What**: Wire screens: draft → battlefield → result. ErrorBoundary wraps all.
- **Flow**: App starts → DraftScreen → confirm → Battlefield → game over → result screen
- **Acceptance**: Full game cycle works end-to-end

### [ ] 10.2 — Win/lose conditions & result screen

- **File**: `src/ui/screens/ResultScreen.tsx`
- **What**: Victory/defeat screen, option to play again
- **Check**: All 5 units killed → game over. Surrender option.

### [ ] 10.3 — Optional: Morale D6

- **File**: `src/game/morale.ts`
- **What**: Before any unit action, optional D6 roll: ⚀=skip turn, ⚅=+1 ATK. Chip re-roll (1 chip).
- **Acceptance**: Works as optional toggle.

### [ ] 10.4 — Balance & polish

- Adjust chip starting amount (20)
- Adjust spell costs
- Adjust hero leadership formula
- AnimatedCard integration for units on field
- Responsive layout
- Sound effects (optional)

---

## Dependency Matrix

```
1.1 Domain types → 1.2 Entity state → 3.1 Store
1.1 → 2.1 Draft logic → 3.1
1.1 → 2.2 Enemy draft AI → 3.1
1.1 → 4.1 Initiative → 4.2 Actions → 5.1 Duel → 3.1
1.1 → 6.1 Spells → 3.1
2.2 + 4.2 + 5.1 → 7.1 Battle AI
1.1 + 2.1 → 8.1 Draft screen
1.1 + 3.1 + 4.2 + 5.1 + 6.1 → 9.1 Battlefield
9.1 → 9.2 Duel panel
8.1 + 9.1 + 9.2 → 10.1 Integration
```

**Parallel batches possible**: 
- Batch A: 1.1 + 1.2 (types)
- Batch B: 2.1 + 2.2 + 4.1 + 6.1 (parallel logic)
- Batch C: 3.1 (store, depends on types and all engines)
- Batch D: 5.1 + 7.1 (duel + AI, parallel)
- Batch E: 8.1 + 4.2 (draft UI + battle loop)
- Batch F: 9.1 + 9.2 (battlefield, depends on store + engines)
- Batch G: 10.1 + 10.2 + 10.3 + 10.4 (integration)

## Final Verification
1. `npx tsc -b` — clean
2. `npx vitest run` — all tests pass (estimated 150+)
3. Manual: full game playthrough — draft → deploy → battle → win/lose
4. Manual: test spells, counterattacks, betting, AI behavior
