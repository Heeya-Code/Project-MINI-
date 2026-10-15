export default function BuildingCard({ name, stats }) {
  return (
    <div className={`card building-card ${name === 'Old Building' ? 'accent-old' : 'accent-new'}`}>
      <h3 style={{ margin: 0 }}>{name}</h3>
      <div className="building-stats">
        <div className="building-stat"><div className="n">{stats.total}</div><div className="l">Total rooms</div></div>
        <div className="building-stat"><div className="n">{stats.available}</div><div className="l">Available now</div></div>
        <div className="building-stat"><div className="n">{stats.occupied}</div><div className="l">Occupied now</div></div>
        <div className="building-stat"><div className="n">{stats.labs}</div><div className="l">Labs</div></div>
        <div className="building-stat"><div className="n">{stats.halls}</div><div className="l">Seminar halls</div></div>
      </div>
    </div>
  )
}
