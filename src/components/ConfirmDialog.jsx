import { useState } from 'react'
import Modal from './Modal'

// Confirmation before a destructive action; optionally collects a required reason.
export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger = false, requireReason = false, reasonLabel = 'Reason', onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  const blocked = requireReason && !reason.trim()
  return (
    <Modal title={title} onClose={onClose}>
      <p style={{ marginTop: 0 }}>{message}</p>
      {requireReason && (
        <div className="field">
          <label htmlFor="confirm-reason">{reasonLabel} (required)</label>
          <textarea id="confirm-reason" rows={3} value={reason} onChange={e => setReason(e.target.value)} autoFocus />
        </div>
      )}
      <div className="btn-row">
        <button className="btn btn-outline" onClick={onClose}>Go back</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={blocked} onClick={() => onConfirm(reason.trim())}>{confirmLabel}</button>
      </div>
    </Modal>
  )
}
