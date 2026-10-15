import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import DashboardCard from '../components/DashboardCard'
import StatusBadge from '../components/StatusBadge'
import ConfirmDialog from '../components/ConfirmDialog'
import ConflictPanel from '../components/ConflictPanel'
import NewLectureRequestModal from '../components/NewLectureRequestModal'
import SeminarProposalModal from '../components/SeminarProposalModal'
import { formatDate, formatRange } from '../utils/dates'
import { classLabel, deptName } from '../utils/lookup'

const TYPE_LABEL = { cancel: 'cancellation', change: 'change', add: 'new lecture' }

function Row({ id, focus, children }) {
  return <div id={`req-${id}`} className={`booking-row ${focus === id ? 'focus-row' : ''}`} style={{ flexWrap: 'wrap' }}>{children}</div>
}

function RequestRow({ r, lecture, admin, focus, onApprove, onReject, feedback }) {
  const p = r.proposal
  return (
    <Row id={r.id} focus={focus}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <strong>{r.type === 'add' ? p.subject : lecture?.subject || 'Lecture'} — {r.kind === 'facultyChange' ? 'faculty change' : TYPE_LABEL[r.type]}</strong>
        <div className="tt-cell-meta">{r.type === 'add' ? classLabel(p) : lecture && classLabel(lecture)}{r.date ? ` · ${formatDate(r.date)}` : ''} · requested by {r.requestedBy.name} · {new Date(r.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</div>
        {r.type === 'change' && <div className="tt-cell-meta">Original: {lecture ? `${formatRange(lecture.start, lecture.end)}, ${lecture.roomId || 'no room listed'}` : '—'} → Proposed: {formatDate(p.newDate)}, {formatRange(p.newStart, p.newEnd)}, {p.newRoomId}{lecture && p.newFaculty !== lecture.faculty ? `, faculty ${p.newFaculty}` : ''}</div>}
        {r.type === 'add' && <div className="tt-cell-meta">Proposed: {p.weekday} {formatRange(p.start, p.end)}, {p.roomId}</div>}
        <div className="tt-cell-meta">Reason: {r.reason}</div>
        {r.decision && <div className="tt-cell-meta">Decision by {r.decision.by}{r.decision.reason ? `: ${r.decision.reason}` : ''}</div>}
      </div>
      <StatusBadge status={r.status} />
      {admin && r.status === 'pending' && (
        <div className="row-actions">
          <button className="btn btn-primary btn-sm" onClick={() => onApprove(r)}>Approve</button>
          <button className="btn btn-outline btn-sm" onClick={() => onReject(r)}>Reject</button>
        </div>
      )}
      {feedback && <div style={{ flexBasis: '100%' }}><ConflictPanel conflicts={feedback.conflicts} alternatives={feedback.alternatives} title="Cannot approve — schedule changed since the request" /></div>}
    </Row>
  )
}

function SeminarRow({ ev, admin, mine, focus, onApprove, onReject, onEdit, feedback }) {
  return (
    <Row id={ev.id} focus={focus}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <strong>{ev.title} — seminar proposal</strong>
        <div className="tt-cell-meta">{formatDate(ev.date)} · {formatRange(ev.start, ev.end)} · {ev.roomId} · for {ev.audience.deptId === 'all' ? 'all departments' : deptName(ev.audience.deptId)}{ev.audience.semester !== 'all' ? ` ${ev.audience.semester}` : ''}</div>
        <div className="tt-cell-meta">Proposed by {ev.proposedBy?.name}{ev.speaker ? ` · Speaker: ${ev.speaker}` : ''}</div>
        {ev.decision && <div className="tt-cell-meta">Decision by {ev.decision.by}{ev.decision.reason ? `: ${ev.decision.reason}` : ''}</div>}
      </div>
      <StatusBadge status={ev.status === 'proposed' ? 'pending' : ev.status === 'scheduled' ? 'approved' : ev.status} />
      {admin && ev.status === 'proposed' && <div className="row-actions"><button className="btn btn-primary btn-sm" onClick={() => onApprove(ev)}>Approve</button><button className="btn btn-outline btn-sm" onClick={() => onReject(ev)}>Reject</button></div>}
      {mine && ev.status === 'proposed' && <div className="row-actions"><button className="btn btn-outline btn-sm" onClick={() => onEdit(ev)}>Edit</button></div>}
      {feedback && <div style={{ flexBasis: '100%' }}><ConflictPanel conflicts={feedback.conflicts} alternatives={feedback.alternatives} title="Cannot approve — venue or time is no longer free" /></div>}
    </Row>
  )
}

export default function RequestsPage() {
  const { user } = useAuth()
  const { state, actions } = useData()
  const toast = useToast()
  const [params] = useSearchParams()
  const focus = params.get('focus')
  const isAdmin = user.role === 'management'
  const [rejecting, setRejecting] = useState(null)
  const [failed, setFailed] = useState({})
  const [newLecture, setNewLecture] = useState(false)
  const [seminar, setSeminar] = useState(null) // null | {} (new) | event (edit)
  const rules = state.settings.teacherRules
  const requests = state.requests.filter(r => isAdmin || r.requestedBy.email === user.email)
  const pending = requests.filter(r => r.status === 'pending')
  const decided = requests.filter(r => r.status !== 'pending')
  const seminars = state.events.filter(e => e.proposedBy && (isAdmin || e.proposedBy.email === user.email))
  const pendingSeminars = seminars.filter(e => e.status === 'proposed')
  const decidedSeminars = seminars.filter(e => e.status !== 'proposed')
  const pendingBookings = state.bookings.filter(b => b.status === 'pending')
  const lec = id => state.lectures.find(l => l.id === id)

  useEffect(() => { if (focus) document.getElementById(`req-${focus}`)?.scrollIntoView?.({ block: 'center' }) }, [focus, state.requests.length, state.events.length])

  const note = r => toast(r.ok ? 'success' : 'error', r.message)
  async function approve(r) {
    const res = await actions.decideRequest({ requestId: r.id, decision: 'approve' })
    note(res); setFailed(f => ({ ...f, [r.id]: res.ok ? null : res }))
  }
  async function approveSeminar(ev) {
    const res = await actions.decideSeminar({ id: ev.id, decision: 'approve' })
    note(res); setFailed(f => ({ ...f, [ev.id]: res.ok ? null : res }))
  }

  return (
    <div className="stack">
      {!isAdmin && (
        <div className="btn-row" style={{ justifyContent: 'flex-start', marginTop: 0 }}>
          <button className="btn btn-primary" onClick={() => setNewLecture(true)}>Request a new lecture</button>
          <button className="btn btn-outline" onClick={() => setSeminar({})}>Propose a seminar</button>
        </div>
      )}
      <DashboardCard title={isAdmin ? 'Pending lecture requests' : 'My lecture requests'}>
        {!isAdmin && (
          <p className="tt-cell-meta" style={{ marginTop: 0 }}>
            Approval rules: room change — <strong>{rules.roomChange === 'direct' ? 'applied directly' : 'needs approval'}</strong>, reschedule — <strong>{rules.reschedule === 'direct' ? 'applied directly' : 'needs approval'}</strong>, cancellation — <strong>{rules.cancel === 'direct' ? 'applied directly' : 'needs approval'}</strong>, faculty change and new lectures — <strong>always need approval</strong>.
          </p>
        )}
        {pending.length === 0 ? <div className="empty-state"><div className="glyph">{'\u21C4'}</div>No requests waiting.</div> : (
          <div className="stack-sm">{pending.map(r => <RequestRow key={r.id} r={r} lecture={lec(r.lectureId)} admin={isAdmin} focus={focus} onApprove={approve} onReject={setRejecting} feedback={failed[r.id]} />)}</div>
        )}
      </DashboardCard>

      <DashboardCard title={isAdmin ? 'Pending seminar proposals' : 'My seminar proposals'}>
        {pendingSeminars.length === 0 ? <p>No seminar proposals waiting.</p> : (
          <div className="stack-sm">{pendingSeminars.map(ev => <SeminarRow key={ev.id} ev={ev} admin={isAdmin} mine={ev.proposedBy?.email === user.email} focus={focus} onApprove={approveSeminar} onReject={e => setRejecting({ seminar: e })} onEdit={setSeminar} feedback={failed[ev.id]} />)}</div>
        )}
      </DashboardCard>

      {isAdmin && (
        <DashboardCard title="Pending room booking requests">
          {pendingBookings.length === 0 ? <p>No booking requests waiting. (Manage all bookings under “All Bookings”.)</p> : pendingBookings.map(b => (
            <Row key={b.id} id={b.id} focus={focus}>
              <div style={{ flex: 1 }}><strong>{b.roomId} — {b.purpose}</strong><div className="tt-cell-meta">{formatDate(b.date)} · {formatRange(b.start, b.end)} · {b.createdBy.name}</div></div>
              <div className="row-actions">
                <button className="btn btn-primary btn-sm" onClick={async () => note(await actions.decideBooking({ id: b.id, decision: 'approve' }))}>Approve</button>
                <button className="btn btn-outline btn-sm" onClick={() => setRejecting({ booking: b })}>Reject</button>
              </div>
            </Row>
          ))}
        </DashboardCard>
      )}

      <DashboardCard title="Decision history">
        {decided.length === 0 && decidedSeminars.length === 0 ? <p>Nothing decided yet.</p> : <div className="stack-sm">
          {decided.map(r => <RequestRow key={r.id} r={r} lecture={lec(r.lectureId)} admin={false} focus={focus} />)}
          {decidedSeminars.map(ev => <SeminarRow key={ev.id} ev={ev} focus={focus} />)}
        </div>}
      </DashboardCard>

      {isAdmin && (
        <DashboardCard title="Approval rules for teachers">
          <p className="tt-cell-meta" style={{ marginTop: 0 }}>Choose what teachers can do directly. “Direct” changes are still blocked if the room/time is not free. Faculty changes, new lectures and seminar proposals always need approval.</p>
          <div className="form-grid">
            {[['roomChange', 'Change lecture room / building'], ['reschedule', 'Reschedule lecture (date / time)'], ['cancel', 'Cancel a lecture']].map(([k, label]) => (
              <div className="field" key={k}><label htmlFor={`rule-${k}`}>{label}</label>
                <select id={`rule-${k}`} value={rules[k]} onChange={async e => note(await actions.setSettings({ teacherRules: { [k]: e.target.value } }))}>
                  <option value="direct">Teacher can do it directly</option><option value="approval">Needs my approval</option></select></div>
            ))}
            <div className="field"><label htmlFor="rule-hall">Teacher books a seminar hall</label>
              <select id="rule-hall" value={state.settings.seminarHallBooking} onChange={async e => note(await actions.setSettings({ seminarHallBooking: e.target.value }))}>
                <option value="direct">Confirmed directly</option><option value="approval">Needs my approval</option></select></div>
          </div>
        </DashboardCard>
      )}

      {rejecting && (
        <ConfirmDialog title="Reject this request?" danger requireReason reasonLabel="Reason for rejection" confirmLabel="Reject" message="The teacher will see your reason."
          onConfirm={async reason => {
            const res = rejecting.booking ? await actions.decideBooking({ id: rejecting.booking.id, decision: 'reject', note: reason })
              : rejecting.seminar ? await actions.decideSeminar({ id: rejecting.seminar.id, decision: 'reject', note: reason })
                : await actions.decideRequest({ requestId: rejecting.id, decision: 'reject', note: reason })
            note(res); setRejecting(null)
          }} onClose={() => setRejecting(null)} />
      )}
      {newLecture && <NewLectureRequestModal onClose={() => setNewLecture(false)} />}
      {seminar && <SeminarProposalModal proposal={seminar.id ? seminar : null} onClose={() => setSeminar(null)} />}
    </div>
  )
}
