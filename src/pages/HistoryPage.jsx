import { useState } from 'react'
import { useData } from '../context/DataContext'
import DashboardCard from '../components/DashboardCard'

export default function HistoryPage() {
  const { state } = useData()
  const [q, setQ] = useState('')
  const rows = state.audit.filter(a => !q || `${a.summary} ${a.by} ${a.action} ${a.reason}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <DashboardCard title="Change History">
      <div className="filter-bar"><input aria-label="Search history" placeholder="Search who / what / why…" value={q} onChange={e => setQ(e.target.value)} /></div>
      {rows.length === 0 ? <div className="empty-state"><div className="glyph">{'\u29D6'}</div>No changes recorded.</div> : (
        <div className="tt-table-wrap">
          <table className="tt-table" style={{ minWidth: 640 }}>
            <thead><tr><th>When</th><th>Who</th><th>What changed</th><th>Reason</th></tr></thead>
            <tbody>{rows.map(a => (
              <tr key={a.id}>
                <td className="tt-cell-meta">{new Date(a.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                <td>{a.by}<div className="tt-cell-meta">{a.role}</div></td>
                <td>{a.summary}<div className="tt-cell-meta">{a.action}</div></td>
                <td>{a.reason || '—'}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </DashboardCard>
  )
}
