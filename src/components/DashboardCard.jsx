export default function DashboardCard({ title, action, children }) {
  return (
    <div className="card">
      {title && (
        <div className="card-title-row">
          <h3>{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}
