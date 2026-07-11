import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the main menu screen', () => {
    render(<App />)
    expect(screen.getByText('Герои Покера')).toBeInTheDocument()
    expect(screen.getByText('и Магии')).toBeInTheDocument()
    expect(screen.getByText('Дуэль')).toBeInTheDocument()
    expect(screen.getByText('🎴 Начать дуэль')).toBeInTheDocument()
  })
})
