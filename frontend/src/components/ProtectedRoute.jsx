import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-8 text-slate-500">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}
