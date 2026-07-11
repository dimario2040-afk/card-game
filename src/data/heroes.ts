/**
 * Hero definitions for the hero-selection screen.
 *
 * Each hero has a unique play-style identity expressed through
 * a title, flavour description, and a single signature ability.
 */

export interface Hero {
  id: string
  name: string
  title: string
  description: string
  abilityName: string
  abilityDescription: string
  /** Tailwind token name used for accent borders / glows */
  accent: string
  /** css `color` value for framer-motion box-shadow interpolation */
  accentColor: string
  icon: string
}

export const HEROES: Hero[] = [
  {
    id: 'ironhoof',
    name: 'Ironhoof',
    title: 'The Unyielding',
    description:
      'A heavily armoured bullman who has never taken a step backwards. ' +
      'Ironhoof absorbs punishment and turns defence into offence.',
    abilityName: 'Adamant Carapace',
    abilityDescription:
      'Gain 5 Shield. While shield holds, deal 2 extra damage on every attack.',
    accent: 'mystic-blue',
    accentColor: '#2563eb',
    icon: '🛡️',
  },
  {
    id: 'librael',
    name: 'Librael',
    title: 'The Scale-Bearer',
    description:
      'A celestial arbiter who bends luck and fate. Librael manipulates the ' +
      'deck to ensure the perfect card is always in reach.',
    abilityName: 'Weave Fate',
    abilityDescription:
      'Look at the top 3 cards of your deck. Draw one and put the rest back in any order.',
    accent: 'mystic-purple',
    accentColor: '#6b21a8',
    icon: '⚖️',
  },
  {
    id: 'ember',
    name: 'Ember',
    title: 'The Wild Spark',
    description:
      'A volatile sorcerer whose power grows with every flame. Ember burns ' +
      'bright and fast — overwhelming opponents before they can respond.',
    abilityName: 'Inferno Surge',
    abilityDescription:
      'Deal 4 damage to the enemy. If this defeats them, draw 2 extra cards next turn.',
    accent: 'gold',
    accentColor: '#ffd700',
    icon: '🔥',
  },
]

export type HeroId = (typeof HEROES)[number]['id']
