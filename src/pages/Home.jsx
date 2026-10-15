import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const features = [
  { icon: '\u25A6', title: 'One timetable per class', desc: 'Pick department, semester and division to see the official published timetable, week by week, with the original PDF a click away.' },
  { icon: '\u21C4', title: 'Changes with approval', desc: 'Teachers request a reschedule, room change, cancellation or new lecture. Administrators review it with conflicts already checked.' },
  { icon: '\u25A3', title: 'Rooms, labs and halls', desc: 'See which classrooms, laboratories and seminar halls are free, and book them without double-booking.' },
  { icon: '\u2605', title: 'Seminars and events', desc: 'Faculty propose seminars; once approved they appear for exactly the classes they concern.' },
  { icon: '\uD83D\uDD14', title: 'Targeted notifications', desc: 'Only the affected division hears about a change. Every notification keeps its read state and links to the right page.' },
  { icon: '\u29D6', title: 'A full audit trail', desc: 'Every approval, rejection and timetable version is recorded with who did it, when and why.' },
]
const steps = [
  ['Request', 'A teacher submits a change with a reason.'],
  ['Review', 'The administrator is notified and sees the clash check.'],
  ['Decide', 'Approval updates the schedule; rejection leaves it untouched.'],
  ['Notify', 'Affected students and the teacher are told, and the timetable shows the change.'],
]
const roles = [
  ['Students', 'See the timetable of their own division, approved changes and cancellations, seminars and notices.'],
  ['Teachers', 'See their lectures, request changes, book rooms and propose seminars.'],
  ['Administrators', 'Publish timetables, decide requests, manage rooms and review the full history.'],
]

export default function Home() {
  const { user } = useAuth()
  const entry = user ? { to: '/app/dashboard', label: 'Open your dashboard' } : { to: '/login', label: 'Log in' }
  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-brand"><span className="lp-mark" aria-hidden="true">T</span> TSEC Sync</div>
        <Link to={entry.to} className="btn btn-brass btn-sm">{entry.label}</Link>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-text">
          <div className="lp-kicker">Thadomal Shahani Engineering College</div>
          <h1>One Campus.<br />One Schedule.</h1>
          <p className="lp-lede">TSEC Sync keeps timetables, lecture changes, rooms, seminars and notifications in one place, so every student, teacher and administrator sees the same, current schedule.</p>
          <div className="hero-actions">
            <Link to={entry.to} className="btn btn-brass">{user ? entry.label : 'Log in to continue'}</Link>
            <a href="#how" className="btn btn-ghost">How it works</a>
          </div>
        </div>
        <div className="lp-hero-art" aria-hidden="true">
          <div className="lp-week">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, i) => (
              <div className="lp-day" key={d}>
                <span>{d}</span>
                <i style={{ height: [46, 30, 58, 38, 50][i] }} />
                <i className={i === 2 ? 'gold' : ''} style={{ height: [28, 52, 24, 44, 26][i] }} />
                <i style={{ height: [36, 24, 40, 30, 34][i] }} />
              </div>
            ))}
          </div>
          <div className="lp-art-note">A week at a glance</div>
        </div>
      </section>

      <section className="lp-section" id="features">
        <h2>Everything the timetable touches</h2>
        <div className="lp-grid">
          {features.map(f => (
            <article className="lp-card" key={f.title}>
              <div className="lp-icon" aria-hidden="true">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section lp-alt" id="how">
        <h2>How a change reaches you</h2>
        <ol className="lp-steps">
          {steps.map(([t, d], i) => <li key={t}><span className="lp-step-no">{i + 1}</span><strong>{t}</strong><p>{d}</p></li>)}
        </ol>
        <p className="lp-fine">New notifications appear within a few seconds of the change being saved.</p>
      </section>

      <section className="lp-section">
        <h2>Built for three roles</h2>
        <div className="lp-grid lp-grid-3">
          {roles.map(([t, d]) => <article className="lp-card" key={t}><h3>{t}</h3><p>{d}</p></article>)}
        </div>
      </section>

      <footer className="lp-foot">TSEC Sync · One Campus. One Schedule. <Link to="/login">Log in</Link></footer>
    </div>
  )
}
