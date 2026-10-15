import { CATEGORY_LABELS } from '../utils/notifications'

const ICONS = { info: '\u2139\uFE0F', warning: '\u26A0\uFE0F', urgent: '\u2757', event: '\u2605' }
const LABEL = { info: 'Update', warning: 'Schedule change', urgent: 'Urgent', event: 'Event' }
const fmtTime = iso => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

const Snapshot = ({ title, s }) => s && (
  <div className="notif-snap">
    <div className="notif-snap-title">{title}</div>
    <div>{s.dateLabel}</div><div>{s.time}</div>
    <div>{s.room || 'Room not listed'}{s.building ? ` · ${s.building}` : ''}{s.floor ? ` · ${s.floor}` : ''}</div>
  </div>
)

// One notification. Unread ones are visually distinct; "Open" jumps to the related page; reading never deletes.
export default function NotificationCard({ notif, onRead, onOpen }) {
  const d = notif.details
  return (
    <div className={`notif-card notif-${notif.severity || 'info'} ${notif.unread ? 'unread' : 'is-read'}`} data-category={notif.category}>
      <span className="notif-icon" aria-hidden="true">{ICONS[notif.severity] || ICONS.info}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="notif-title">
          {notif.title} {notif.unread && <span className="badge badge-warn" style={{ marginLeft: 6 }}>New</span>}
        </div>
        <div className="tt-cell-meta">{CATEGORY_LABELS[notif.category] || 'Update'} · {LABEL[notif.severity] || 'Update'}{notif.subject ? ` · ${notif.subject}` : ''}{d?.status ? ` · ${d.status}` : ''}</div>
        <div className="notif-body">{notif.body}</div>
        {(notif.original || notif.updated) && (
          <div className="notif-compare">
            <Snapshot title="Original" s={notif.original} />
            {notif.updated && <Snapshot title={notif.original ? 'Requested / updated' : 'Details'} s={notif.updated} />}
          </div>
        )}
        {notif.reason && <div className="notif-time">Reason: {notif.reason}</div>}
        <div className="notif-time">{fmtTime(notif.createdAt)}{notif.publishedBy ? ` · by ${notif.publishedBy}` : ''}</div>
        <div className="btn-row" style={{ justifyContent: 'flex-start', marginTop: 6 }}>
          {onOpen && notif.link && <button className="btn btn-outline btn-sm" onClick={() => onOpen(notif)}>Open</button>}
          {notif.unread && onRead && <button className="btn btn-outline btn-sm" onClick={() => onRead(notif.id)}>Mark as read</button>}
        </div>
      </div>
    </div>
  )
}
