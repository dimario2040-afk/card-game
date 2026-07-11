import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HEROES } from '@/data/heroes.ts'
import type { Hero } from '@/data/heroes.ts'

// ── Types ───────────────────────────────────────────────────────────────

interface HeroSelectProps {
  onStartDuel: (heroId: string) => void
}

// ── Staggered container variant ─────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.2 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.92 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: 'easeOut' as const },
  },
} as const

// ── Helpers ─────────────────────────────────────────────────────────────

/** Map hero accent name to the matching Tailwind border class. */
function borderAccentClass(accent: string): string {
  const map: Record<string, string> = {
    'mystic-blue': 'border-mystic-blue',
    'mystic-purple': 'border-mystic-purple',
    gold: 'border-gold',
  }
  return map[accent] ?? 'border-white/20'
}

/** Map hero accent name for a soft background glow. */
function bgAccentClass(accent: string): string {
  const map: Record<string, string> = {
    'mystic-blue': 'bg-mystic-blue/10',
    'mystic-purple': 'bg-mystic-purple/10',
    gold: 'bg-gold/10',
  }
  return map[accent] ?? 'bg-white/5'
}

/** Map hero accent name for text colour. */
function textAccentClass(accent: string): string {
  const map: Record<string, string> = {
    'mystic-blue': 'text-mystic-blue',
    'mystic-purple': 'text-mystic-purple',
    gold: 'text-gold',
  }
  return map[accent] ?? 'text-white'
}

// ── Hero ability detail panel ───────────────────────────────────────────

function AbilityDetail({ hero }: { hero: Hero }) {
  return (
    <motion.div
      key={hero.id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`rounded-xl border ${borderAccentClass(hero.accent)} ${bgAccentClass(hero.accent)} p-5 backdrop-blur-sm`}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xl">{hero.icon}</span>
        <h3 className="font-game text-sm font-bold uppercase tracking-wider text-white/70">
          Signature Ability
        </h3>
      </div>
      <p className={`font-game text-lg font-bold ${textAccentClass(hero.accent)}`}>
        {hero.abilityName}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-gray-300">
        {hero.abilityDescription}
      </p>
    </motion.div>
  )
}

// ── Hero card ───────────────────────────────────────────────────────────

interface HeroCardProps {
  hero: Hero
  isSelected: boolean
  onSelect: () => void
}

function HeroCard({ hero, isSelected, onSelect }: HeroCardProps) {
  return (
    <motion.div
      variants={cardVariants}
      layout
      onClick={onSelect}
      whileHover={{ y: -8, transition: { duration: 0.25, ease: 'easeOut' } }}
      whileTap={{ scale: 0.97 }}
      animate={
        isSelected
          ? {
              borderColor: hero.accentColor,
              boxShadow: `0 0 24px ${hero.accentColor}66, 0 0 48px ${hero.accentColor}33`,
              transition: { duration: 0.3, ease: 'easeOut' },
            }
          : {
              borderColor: 'rgba(255,255,255,0.08)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              transition: { duration: 0.3, ease: 'easeOut' },
            }
      }
      className={`relative cursor-pointer select-none rounded-2xl border bg-white/5 p-6 backdrop-blur-sm ${
        isSelected ? '' : 'hover:border-white/20 hover:bg-white/[0.07]'
      }`}
    >
      {/* Icon */}
      <div className="mb-4 flex justify-center">
        <span className="text-5xl">{hero.icon}</span>
      </div>

      {/* Name + Title */}
      <h2 className="font-game text-center text-xl font-bold text-white">
        {hero.name}
      </h2>
      <p className={`mb-3 text-center font-game text-xs font-bold uppercase tracking-widest ${textAccentClass(hero.accent)}`}>
        {hero.title}
      </p>

      {/* Description */}
      <p className="mb-4 text-center text-sm leading-relaxed text-gray-400">
        {hero.description}
      </p>

      {/* Ability preview pill */}
      <div
        className={`mx-auto flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 ${borderAccentClass(hero.accent)} ${bgAccentClass(hero.accent)}`}
      >
        <span className="text-xs text-gray-400">Ability:</span>
        <span className={`text-xs font-semibold ${textAccentClass(hero.accent)}`}>
          {hero.abilityName}
        </span>
      </div>

      {/* Selection indicator ring */}
      {isSelected && (
        <motion.div
          layoutId="hero-select-ring"
          className="pointer-events-none absolute -inset-[3px] rounded-[1rem] border-2"
          style={{ borderColor: hero.accentColor }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        />
      )}
    </motion.div>
  )
}

// ── Main screen ─────────────────────────────────────────────────────────

export function HeroSelect({ onStartDuel }: HeroSelectProps) {
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null)
  const selectedHero = HEROES.find((h) => h.id === selectedHeroId) ?? null

  const canDuel = selectedHeroId !== null

  const handleDuel = () => {
    if (!selectedHeroId) return
    onStartDuel(selectedHeroId)
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-surface via-[#0d1117] to-surface-light text-white">
      {/* ── Header ─────────────────────────────────── */}
      <header className="border-b border-white/10 px-6 py-5 text-center">
        <motion.h1
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="font-game text-3xl font-bold text-gold animate-glow"
        >
          Choose Your Champion
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="mt-1 text-sm text-gray-500"
        >
          Select a hero and step into the arena
        </motion.p>
      </header>

      {/* ── Hero grid ──────────────────────────────── */}
      <main className="flex flex-1 flex-col items-center px-4 py-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-3"
        >
          {HEROES.map((hero) => (
            <HeroCard
              key={hero.id}
              hero={hero}
              isSelected={selectedHeroId === hero.id}
              onSelect={() => setSelectedHeroId(hero.id)}
            />
          ))}
        </motion.div>

        {/* ── Detail panel ─────────────────────────── */}
        <div className="mt-8 w-full max-w-xl">
          <AnimatePresence mode="wait">
            {selectedHero ? (
              <AbilityDetail key={selectedHero.id} hero={selectedHero} />
            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-white/5 bg-white/[0.02] p-5 text-center"
              >
                <p className="text-sm italic text-gray-600">
                  Click a hero to see their ability details
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Duel button ──────────────────────────── */}
        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4, ease: 'easeOut' }}
        >
          <motion.button
            onClick={handleDuel}
            disabled={!canDuel}
            whileHover={canDuel ? { scale: 1.05 } : undefined}
            whileTap={canDuel ? { scale: 0.96 } : undefined}
            animate={
              canDuel
                ? {
                    boxShadow: [
                      '0 0 16px rgba(255,215,0,0.3)',
                      '0 0 32px rgba(255,215,0,0.5)',
                      '0 0 16px rgba(255,215,0,0.3)',
                    ],
                  }
                : {}
            }
            transition={
              canDuel
                ? { boxShadow: { duration: 2, repeat: Infinity, ease: 'easeInOut' } }
                : undefined
            }
            className={`rounded-xl px-10 py-3 font-game text-lg font-bold uppercase tracking-widest transition-colors duration-200 ${
              canDuel
                ? 'cursor-pointer bg-gold text-surface shadow-lg hover:bg-gold/90'
                : 'cursor-not-allowed bg-white/10 text-gray-500'
            }`}
          >
            {canDuel ? '⚔️  Duel!' : 'Select a Hero'}
          </motion.button>
        </motion.div>
      </main>
    </div>
  )
}
