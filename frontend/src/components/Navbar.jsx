import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

export default function Navbar() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  if (!user) return null
  const linkCls = ({ isActive }) =>
    `px-3 py-2 text-sm font-medium rounded ${
      isActive ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:text-slate-900'
    }`
  return (
    <nav className="bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="font-semibold text-slate-900">
            TeamTask
          </Link>
          <div className="flex gap-1">
            <NavLink to="/" end className={linkCls}>
              Dashboard
            </NavLink>
            <NavLink to="/projects" className={linkCls}>
              Projects
            </NavLink>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">{user.full_name}</span>
          <button
            className="btn-secondary"
            onClick={() => {
              logout()
              nav('/login')
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  )
}
