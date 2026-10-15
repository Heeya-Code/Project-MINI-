import { Link } from 'react-router-dom'

export default function AccessDenied() {
  return (
    <div className="card empty-state" role="alert">
      <div className="glyph">{'\uD83D\uDD12'}</div>
      <h3>Access denied</h3>
      <p>Your role does not have permission to open this page.</p>
      <Link to="/app/dashboard" className="btn btn-primary">Back to dashboard</Link>
    </div>
  )
}
