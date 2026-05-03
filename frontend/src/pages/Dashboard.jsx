import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { PriorityBadge, StatusBadge, formatDue, isOverdue } from '../components/TaskBadges.jsx'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api
      .get('/api/dashboard')
      .then((r) => setData(r.data))
      .catch((e) => setErr(e.response?.data?.detail || 'Failed to load dashboard'))
  }, [])

  async function updateStatus(id, status) {
    try {
      await api.patch(`/api/tasks/${id}/status`, { status })
      const r = await api.get('/api/dashboard')
      setData(r.data)
    } catch (e) {
      alert(e.response?.data?.detail || 'Update failed')
    }
  }

  if (err) return <div className="max-w-6xl mx-auto p-4 text-red-600">{err}</div>
  if (!data) return <div className="max-w-6xl mx-auto p-4 text-slate-500">Loading…</div>

  const counts = data.status_counts
  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="To do" value={counts.todo} />
        <Stat label="In progress" value={counts.in_progress} />
        <Stat label="Done" value={counts.done} />
        <Stat label="Overdue" value={data.overdue_count} tone={data.overdue_count ? 'red' : ''} />
      </div>

      <Section title="My tasks">
        <TaskTable tasks={data.my_tasks} onStatus={updateStatus} />
      </Section>

      {data.overdue_tasks.length > 0 && (
        <Section title="Overdue">
          <TaskTable tasks={data.overdue_tasks} onStatus={updateStatus} />
        </Section>
      )}
    </div>
  )
}

function Stat({ label, value, tone }) {
  const tint =
    tone === 'red' ? 'text-red-600' : 'text-slate-900'
  return (
    <div className="card">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-3xl font-semibold mt-1 ${tint}`}>{value}</div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <div className="card p-0 overflow-hidden">{children}</div>
    </div>
  )
}

function TaskTable({ tasks, onStatus }) {
  if (!tasks.length) return <div className="p-6 text-slate-500 text-sm">No tasks.</div>
  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-left text-slate-600">
        <tr>
          <th className="px-4 py-2">Title</th>
          <th className="px-4 py-2">Project</th>
          <th className="px-4 py-2">Priority</th>
          <th className="px-4 py-2">Due</th>
          <th className="px-4 py-2">Status</th>
          <th className="px-4 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((t) => (
          <tr key={t.id} className="border-t border-slate-100">
            <td className="px-4 py-2 font-medium">{t.title}</td>
            <td className="px-4 py-2">
              <Link to={`/projects/${t.project_id}`} className="text-indigo-600 hover:underline">
                #{t.project_id}
              </Link>
            </td>
            <td className="px-4 py-2"><PriorityBadge priority={t.priority} /></td>
            <td className={`px-4 py-2 ${isOverdue(t) ? 'text-red-600 font-medium' : ''}`}>
              {formatDue(t.due_date)}
            </td>
            <td className="px-4 py-2"><StatusBadge status={t.status} /></td>
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
          </tr>
        ))}
      </tbody>
    </table>
  )
}
