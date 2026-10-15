export default function StatCard({ label, value, tone }) {
  return (
    <div className={`card stat-card ${tone ? `accent-${tone}` : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
