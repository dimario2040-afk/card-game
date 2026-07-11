import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useGameStore } from '@/store/game-store'
import { Battlefield } from './ui/screens/Battlefield'
import { DraftScreen } from './ui/screens/DraftScreen'
import { ResultScreen } from './ui/screens/ResultScreen'
import { MenuScreen } from './ui/screens/MenuScreen'
import type { Card } from '@/types'

// ─── Error Boundary ─────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Game crashed:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-surface via-[#0d1117] to-surface-light text-white">
          <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center backdrop-blur-sm">
            <h1 className="mb-2 font-game text-2xl font-bold text-red-400">
              Game Crashed
            </h1>
            <p className="mb-4 text-sm text-gray-400">
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="cursor-pointer rounded-lg bg-gold/20 px-6 py-2 font-game text-sm text-gold transition-colors hover:bg-gold/30"
            >
              Restart
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Screen router ──────────────────────────────────────────────────────

function ScreenRouter() {
  const phase = useGameStore((s) => s.phase)
  const playerHand = useGameStore((s) => s.playerHand)
  const initDraft = useGameStore((s) => s.initDraft)

  // Safety: if phase is draft but no hand dealt yet, deal one
  if (phase === 'draft' && playerHand.length === 0) {
    initDraft()
  }

  switch (phase) {
    case 'menu':
      return <MenuScreen />
    case 'draft':
      return <DraftScreen />
    case 'finished':
      return <ResultScreen />
    default:
      return (
        <div className="min-h-screen bg-gradient-to-br from-surface via-[#0d1117] to-surface-light text-white">
          <main className="p-4">
            <Battlefield />
          </main>
        </div>
      )
  }
}

// ─── App ────────────────────────────────────────────────────────────────

function App() {
  return (
    <ErrorBoundary>
      <ScreenRouter />
    </ErrorBoundary>
  )
}

export default App
