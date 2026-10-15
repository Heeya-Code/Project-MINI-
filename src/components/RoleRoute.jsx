import { useAuth } from '../context/AuthContext'
import AccessDenied from './AccessDenied'

// Route guard: renders the page only for the listed roles. (Client-side only —
// see utils/permissions.js for the honest security note.)
export default function RoleRoute({ roles, children }) {
  const { user } = useAuth()
  return roles.includes(user?.role) ? children : <AccessDenied />
}
