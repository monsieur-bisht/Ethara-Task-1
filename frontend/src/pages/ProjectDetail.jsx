import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { PriorityBadge, StatusBadge, formatDue, isOverdue } from '../components/TaskBadges.jsx'

export default function ProjectDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [project, setProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [stats, setStats] = useState(null)
  const [err, setErr] = useState('')

  async function load() {
    try {
      const [p, t, s] = await Promise.all([
        api.get(`/api/projects/${id}`),
        api.get(`/api/projects/${id}/tasks`),
        api.get(`/api/projects/${id}/stats`),
      ])
      setProject(p.data)
      setTasks(t.data)
      setStats(s.data)
    } catch (e) {
      setErr(e.response?.data?.detail || 'Failed to load project')
    }
  }

  useEffect(() => {
    load()
  }, [id])

  async function onDeleteProject() {
    if (!confirm('Delete this project? This cannot be undone.')) return
    try {
      await api.delete(`/api/projects/${id}`)
      nav('/projects')
    } catch (e) {
      alert(e.response?.data?.detail || 'Delete failed')
    }
  }

  if (err) return <div className="max-w-6xl mx-auto p-4 text-red-600">{err}</div>
  if (!project) return <div className="max-w-6xl mx-auto p-4 text-slate-500">Loading…</div>

  const isAdmin = project.my_role === 'ADMIN'

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-slate-600 mt-1">{project.description || 'No description'}</p>
        </div>
        {isAdmin && (
          <button className="btn-danger" onClick={onDeleteProject}>
            Delete project
          </button>
        )}
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Total" value={stats.total} />
          <Stat label="Completed" value={stats.completed} />
          <Stat label="Pending" value={stats.pending} />
          <Stat label="Overdue" value={stats.overdue} tone={stats.overdue ? 'red' : ''} />
        </div>
      )}

      <Members project={project} isAdmin={isAdmin} reload={load} />

      <Tasks
        projectId={project.id}
        tasks={tasks}
        members={project.members}
        isAdmin={isAdmin}
        reload={load}
      />
    </div>
  )
}

function Stat({ label, value, tone }) {
  return (
    <div className="card">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-3xl font-semibold mt-1 ${tone === 'red' ? 'text-red-600' : ''}`}>
        {value}
      </div>
    </div>
  )
}

function Members({ project, isAdmin, reload }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('MEMBER')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function onAdd(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await api.post(`/api/projects/${project.id}/members`, { email, role })
      setEmail('')
      await reload()
    } catch (e) {
      setErr(e.response?.data?.detail || 'Add failed')
    } finally {
      setBusy(false)
    }
  }

  async function onChangeRole(userId, newRole) {
    try {
      await api.patch(`/api/projects/${project.id}/members/${userId}`, { role: newRole })
      await reload()
    } catch (e) {
      alert(e.response?.data?.detail || 'Update failed')
    }
  }

  async function onRemove(userId) {
    if (!confirm('Remove this member?')) return
    try {
      await api.delete(`/api/projects/${project.id}/members/${userId}`)
      await reload()
    } catch (e) {
      alert(e.response?.data?.detail || 'Remove failed')
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Members</h2>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {project.members.map((m) => (
              <tr key={m.user.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{m.user.full_name}</td>
                <td className="px-4 py-2 text-slate-600">{m.user.email}</td>
                <td className="px-4 py-2">
                  {isAdmin ? (
                    <select
                      className="text-xs rounded border-slate-300"
                      value={m.role}
                      onChange={(e) => onChangeRole(m.user.id, e.target.value)}
                    >
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  ) : (
                    <span className="badge bg-slate-100 text-slate-700">{m.role}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {isAdmin && (
                    <button
                      onClick={() => onRemove(m.user.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <form onSubmit={onAdd} className="mt-3 flex gap-2 items-end">
          <div className="flex-1">
            <label className="label">Add member by email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="label">Role</label>
            <select
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <button className="btn-primary" disabled={busy}>
            {busy ? 'Adding…' : 'Add'}
          </button>
        </form>
      )}
      {err && <p className="text-red-600 text-sm mt-2">{err}</p>}
    </div>
  )
}

function Tasks({ projectId, tasks, members, isAdmin, reload }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    due_date: '',
    assignee_id: '',
  })
  const [busy, setBusy] = useState(false)

  async function onCreate(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
      }
      await api.post(`/api/projects/${projectId}/tasks`, payload)
      setForm({ title: '', description: '', priority: 'MEDIUM', due_date: '', assignee_id: '' })
      setShowForm(false)
      await reload()
    } catch (e) {
      alert(e.response?.data?.detail || 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  async function onStatus(id, status) {
    try {
      await api.patch(`/api/tasks/${id}/status`, { status })
      await reload()
    } catch (e) {
      alert(e.response?.data?.detail || 'Update failed')
    }
  }

  async function onAssign(id, assigneeId) {
    try {
      await api.patch(`/api/tasks/${id}`, { assignee_id: assigneeId ? Number(assigneeId) : null })
      await reload()
    } catch (e) {
      alert(e.response?.data?.detail || 'Update failed')
    }
  }

  async function onDelete(id) {
    if (!confirm('Delete this task?')) return
    try {
      await api.delete(`/api/tasks/${id}`)
      await reload()
    } catch (e) {
      alert(e.response?.data?.detail || 'Delete failed')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">Tasks</h2>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Cancel' : 'New task'}
          </button>
        )}
      </div>

      {showForm && isAdmin && (
        <form onSubmit={onCreate} className="card grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div className="md:col-span-2">
            <label className="label">Title</label>
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Description</label>
            <textarea
              className="input"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Priority</label>
            <select
              className="input"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
          <div>
            <label className="label">Due date</label>
            <input
              type="date"
              className="input"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Assignee</label>
            <select
              className="input"
              value={form.assignee_id}
              onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}
            >
              <option value="">— Unassigned —</option>
              {members.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.full_name} ({m.user.email})
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <button className="btn-primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create task'}
            </button>
          </div>
        </form>
      )}

      <div className="card p-0 overflow-hidden">
        {tasks.length === 0 ? (
          <div className="p-6 text-slate-500 text-sm">No tasks yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Assignee</th>
                <th className="px-4 py-2">Priority</th>
                <th className="px-4 py-2">Due</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-2">
                    <div className="font-medium">{t.title}</div>
                    {t.description && (
                      <div className="text-slate-500 text-xs mt-0.5 line-clamp-2">{t.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isAdmin ? (
                      <select
                        className="text-xs rounded border-slate-300"
                        value={t.assignee?.id || ''}
                        onChange={(e) => onAssign(t.id, e.target.value)}
                      >
                        <option value="">— Unassigned —</option>
                        {members.map((m) => (
                          <option key={m.user.id} value={m.user.id}>
                            {m.user.full_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span>{t.assignee?.full_name || '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-2"><PriorityBadge priority={t.priority} /></td>
                  <td className={`px-4 py-2 ${isOverdue(t) ? 'text-red-600 font-medium' : ''}`}>
                    {formatDue(t.due_date)}
                  </td>
                  <td className="px-4 py-2">
                    <select
                      className="text-xs rounded border-slate-300"
                      value={t.status}
                      onChange={(e) => onStatus(t.id, e.target.value)}
                    >
                      <option value="TODO">To do</option>
                      <option value="IN_PROGRESS">In progress</option>
                      <option value="DONE">Done</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {isAdmin && (
                      <button
                        onClick={() => onDelete(t.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
