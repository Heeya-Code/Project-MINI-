import { createContext, useContext, useMemo } from 'react'
import { useData } from './DataContext'
import { categoryFor } from '../utils/notifications'

const NotificationsContext = createContext({ notifications: [], unreadCount: 0, markAllRead() {}, markRead() {} })

// The server already sends each user ONLY the notifications they are a recipient of, and only their own
// read marks. Marking as read never deletes anything.
export function NotificationsProvider({ children }) {
  const { state, actions } = useData() || {}
  const value = useMemo(() => {
    const read = new Set(Object.values(state?.reads || {})[0] || [])
    const notifications = (state?.notifications || []).map(n => ({ ...n, category: categoryFor(n), unread: !read.has(n.id) }))
    const unread = notifications.filter(n => n.unread)
    return {
      notifications,
      unreadCount: unread.length,
      markAllRead: () => actions.markRead(unread.map(n => n.id)),
      markRead: id => actions.markRead([id]),
    }
  }, [state?.notifications, state?.reads, actions])
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export const useNotifications = () => useContext(NotificationsContext)
