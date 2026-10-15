export default function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null
  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.kind === 'error' ? 'toast-error' : t.kind === 'success' ? 'toast-success' : ''}`} onClick={() => onDismiss(t.id)}>
          <span>{t.kind === 'success' ? '\u2713' : t.kind === 'error' ? '\u2715' : '\u26A0'}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
