# Draft: full-game-rebuild

## Intent
**CLEAR**, review_required: false  
User provided the full game design spec for "Герои Покера и Магии: Дуэль". Current codebase is a simplified MVP. Need a complete rebuild.

## Architecture Analysis

### What changes

| Layer | Verdict | Reason |
|---|---|---|
| `src/types/index.ts` | REWRITE | New domain: Unit, FieldSlot, DraftState, DuelState, Spell |
| `src/types/game.ts` | REWRITE | New EntityState with units on field, chips, draft phase |
| `src/store/game-store.ts` | REWRITE | Completely different state model + actions |
| `src/game/hand-evaluator.ts` | **REUSE** | Poker hand ranking unchanged for duels |
| `src/game/combat-engine.ts` | REWRITE | New duel system (betting → hand compare → damage) |
| `src/game/game-loop.ts` | REWRITE | Draft phase, SPD initiative, unit actions |
| `src/ai/decision-engine.ts` | REWRITE | Unit tactics, positioning, betting AI |
| `src/ui/screens/HeroSelect.tsx` | REWRITE | Now integrated into draft (pick hero card from hand) |
| `src/ui/animations/GameBoard.tsx` | REWRITE | New battlefield: 2 lines × 5 slots, unit display |
| `src/ui/animations/PlaySlot.tsx` | REWRITE | Now shows deployed units with stats |
| `src/ui/animations/DeckArea.tsx` | EXTEND | Draft hand selection, duel hand selection |
| `src/ui/animations/AnimatedCard.tsx` | REUSE | Card component still works |
| `src/data/heroes.ts` | REWRITE | New hero model: value + suit + leadership bonus |
| `src/App.tsx` | REWRITE | New flow: Draft → Battle → Result |

### What stays
- `src/ui/animations/AnimatedCard.tsx` — card component
- `src/ui/animations/PhaseBanner.tsx` — banners
- `src/ui/animations/DamageNumber.tsx` — damage floats
- `src/ui/animations/DiscardPile.tsx` — discard visualization
- `src/game/hand-evaluator.ts` + tests — poker hand ranking
- `src/index.css` — Tailwind setup
- `src/main.tsx` — entry point
- `vite.config.ts` — build config
- `src/test/setup.ts` — test setup

## Phased Implementation Plan

### Phase 1: Core Domain Model & Unit Stats
**Files**: `src/types/game.ts`, `src/types/index.ts`, `src/game/unit-stats.ts`

New types:
```typescript
// Unit type from suit
type UnitType = 'melee' | 'ranged' | 'flying' | 'spellcaster'

// Card on the field = unit
interface Unit {
  cardId: string
  baseCard: Card
  unitType: UnitType
  atk: number    // card value + bonuses
  def: number    // value/2 + bonuses
  hp: number     // by tier
  maxHp: number
  spd: number    // 15 - value
  line: 'front' | 'back'
  slot: 0 | 1 | 2 | 3 | 4
  owner: 'player' | 'enemy'
}

// Field = 3 front + 2 back slots
type FieldSlots = [Unit | null, Unit | null, Unit | null, Unit | null, Unit | null]

interface FieldLine {
  front: FieldSlots  // indices 0-2
  back: FieldSlots   // indices 0-1
}
```

Conversion functions: card → unit stats (pure, testable).

### Phase 2: Draft Phase Logic
**Files**: `src/game/draft.ts`, test file

- Shuffle 52-card deck, deal 10 to each player
- Player selects: 1 hero card + 5 unit cards
- Remaining 4 → starting hand
- Deploy: hero goes aside, 5 units arranged in 2 lines
- Hero bonuses applied to matching units

### Phase 3: Game State & Store
**Files**: `src/store/game-store.ts`

New state shape:
```typescript
interface GameState {
  phase: 'draft' | 'battle' | 'finished'
  turn: number
  
  // Player
  playerDeck: Card[]
  playerHand: Card[]
  playerDiscard: Card[]
  playerChips: number     // ~20
  playerField: FieldLine
  playerHero: { card: Card; bonuses: HeroBonuses } | null
  
  // Enemy (same structure)
  ...
  
  // Battle state
  initiative: Unit[]       // sorted by SPD
  selectedUnit: string | null
  duelState: DuelState | null
  combatLog: string[]
  winner: string | null
}
```

### Phase 4: Battle Turn Engine
**Files**: `src/game/battle-loop.ts`

Turn flow:
1. Draw phase (draw to 5)
2. Initiative (sort all units by SPD)
3. Unit actions loop (for each unit in initiative order):
   a. Select action (move / attack / spell / pass)
   b. If attack → enter Duel sub-phase
   c. If spell → enter Spell sub-phase
4. End phase (tick effects, check win)

### Phase 5: Combat Duel System
**Files**: `src/game/duel-engine.ts`

Duel sub-phase:
1. Attacker declares target + places bet (1+ chips)
2. Defender chooses: fold / call / raise
   - Fold → auto-hit, damage = ATK - DEF (min 1)
   - Call → both pick 1-5 cards from hand, reveal, compare poker hands
   - Raise → same but defender adds more chips
3. Hand comparison: (hand rank + ATK) vs (hand rank + DEF)
   - Attacker wins → damage = difference (min 1)
   - Defender wins → blocked, no damage
   - Tie → base damage = ATK - DEF (min 0)
4. Counterattack if defender is melee/flying in front line and survived
5. Used cards → discard, winner takes chip pot

### Phase 6: Spell System
**Files**: `src/game/spells.ts`

Spell catalog:
- Magic Arrow (discard 1, 1 chip): damage = discarded card value
- Lightning (discard pair, 2 chips): 5 damage to target
- Haste (discard two pair, 2 chips): +2 SPD, extra turn
- Stone Skin (discard triple, 3 chips): +3 DEF
- Resurrection (discard full house, 4 chips): revive 1 HP
- Meteor (discard straight, 4 chips): 2 AoE damage

### Phase 7: AI
**Files**: `src/ai/*.ts`

AI needs:
- Draft: choose hero + units based on synergy
- Deployment: arrange units in lines
- Targeting: prioritize threats
- Betting: value bet / bluff / fold decisions
- Spell usage
- 3 personalities (aggro/balanced/defensive)

### Phase 8: UI - Draft Screen
**Files**: `src/ui/screens/DraftScreen.tsx`

- Show 10 dealt cards
- Tap to select hero (highlight)
- Tap 5 to deploy as units
- Drag to arrange front/back line
- Confirm button

### Phase 9: UI - Battlefield
**Files**: `src/ui/screens/Battlefield.tsx`

- Two opposing fields (2 lines each)
- Unit cards with: type icon, ATK/DEF/HP/SPD bars
- Hand panel at bottom
- Selected unit glow
- Targeting arrows
- Duel panel (bet / fold / raise buttons)
- Hand selection for duel
- Spell panel for spade units
- Chip display
- Combat log

### Phase 10: Integration & Polish
- Wire everything in App.tsx
- End conditions (all units dead / surrender)
- Deck reshuffle from discard
- Balance tuning
- Visual effects

## Decisions
- **No router**: Use gamePhase state to swap screens (draft → battlefield → result)
- **No external dependencies**: All UI with React/Framer Motion/Tailwind
- **Standard 52-card deck**: Card value is primary stat source
- **Chips start at 20**: Can adjust for balance
- **Optional morale**: Implement as simple D6 roll with chip re-roll

## Status
- [ ] awaiting-approval
- [x] exploration-done
- [ ] plan-written
- [ ] implemented
