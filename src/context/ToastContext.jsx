import { createContext, useCallback, useContext, useState } from 'react'
import ToastStack from '../components/Toast'

const ToastContext = createContext(() => {})

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const dismiss = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), [])
  // toast('success' | 'error' | 'info', 'message')
  const toast = useCallback((kind, message) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(t => [...t, { id, kind, message }])
    setTimeout(() => dismiss(id), 4500)
  }, [dismiss])
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
