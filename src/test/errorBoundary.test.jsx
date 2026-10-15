import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorBoundary from '../components/ErrorBoundary'

describe('ErrorBoundary', () => {
  it('shows a friendly screen instead of a blank page when rendering fails, and renders children normally otherwise', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const Boom = () => { throw new Error('boom') }
    const { unmount } = render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i)
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument()
    unmount(); spy.mockRestore()
    render(<ErrorBoundary><p>fine</p></ErrorBoundary>)
    expect(screen.getByText('fine')).toBeInTheDocument()
  })
})
