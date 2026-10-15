import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLES = [
  { id: 'student', label: 'Student' },
  { id: 'teacher', label: 'Teacher' },
  { id: 'management', label: 'Administrator' },
]


export default function LoginForm() {
  const [role, setRole] = useState('student')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login, demoAccounts } = useAuth()
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setBusy(true)
    const result = await login(email, password, role)
    setBusy(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    navigate('/app/dashboard')
  }

  const demos = demoAccounts.filter(u => u.role === role)
  function fillDemo(account) {
    setEmail(account.email)
    setPassword(account.password)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="role-toggle">
        {ROLES.map(r => (
          <button
            type="button"
            key={r.id}
            className={`role-btn ${role === r.id ? 'active' : ''}`}
            onClick={() => setRole(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="email">College email</label>
        <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@tsec.edu" />
      </div>
      <div className="field" style={{ marginBottom: 6 }}>
        <label htmlFor="password">Password</label>
        <input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
      </div>

      {error && <div className="form-msg form-msg-error">{error}</div>}

      <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 14 }} disabled={busy}>
        {busy ? 'Signing in…' : `Log in as ${ROLES.find(r => r.id === role).label}`}
      </button>

      {demos.length > 0 && <div className="demo-creds">
        <div>Demo accounts (development server only):</div>
        {demos.map(a => (
          <button type="button" key={a.email} className="btn btn-outline btn-sm" style={{ marginTop: 6, marginRight: 6 }} onClick={() => fillDemo(a)}>
            {a.name} · {a.email}
          </button>
        ))}
      </div>}
    </form>
  )
}
