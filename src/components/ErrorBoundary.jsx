import { Component } from 'react'

// Last line of defence: an unexpected rendering error shows a friendly screen instead of a blank page.
// "Reload" opens the public home page (every reload does), from where the user can sign in again.
export default class ErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error) { console.error('TSEC Sync UI error:', error) }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="login-wrap">
        <div className="login-card" role="alert">
          <h2 style={{ marginBottom: 6 }}>Something went wrong</h2>
          <p>The page could not be displayed. Your data is safe on the server. Reload to return to the home page.</p>
          <button className="btn btn-primary" onClick={() => window.location.assign('/')}>Reload</button>
        </div>
      </div>
    )
  }
}
