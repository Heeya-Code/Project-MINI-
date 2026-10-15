const TONES = {
  Available: 'good', Occupied: 'bad', Reserved: 'warn',
  scheduled: 'good', approved: 'good', Open: 'good', published: 'info',
  rescheduled: 'warn', pending: 'warn', Rescheduled: 'warn',
  cancelled: 'bad', rejected: 'bad', Cancelled: 'bad', Full: 'bad',
  completed: 'neutral',
}
const LABELS = { scheduled: 'Scheduled', rescheduled: 'Rescheduled', cancelled: 'Cancelled', pending: 'Pending approval', approved: 'Approved', rejected: 'Rejected', completed: 'Completed', published: 'Published' }

export default function StatusBadge({ status }) {
  const tone = TONES[status] || 'neutral'
  return (
    <span className={`badge badge-${tone}`}>
      <span className={`dot dot-${tone}`} />
      {LABELS[status] || status}
    </span>
  )
}
