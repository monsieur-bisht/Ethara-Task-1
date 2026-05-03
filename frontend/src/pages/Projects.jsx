import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [err, setErr] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const r = await api.get('/api/projects')
      setProjects(r.data)
    } catch (e) {
      setErr(e.response?.data?.detail || 'Failed to load projects')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function onCreate(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post('/api/projects', { name, description: description || null })
      setName('')
      setDescription('')
      setShowForm(false)
      await load()
    } catch (e) {
      alert(e.response?.data?.detail || 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : 'New project'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="card space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <textarea
              className="input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <button className="btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create project'}
          </button>
        </form>
      )}

      {err && <p className="text-red-600 text-sm">{err}</p>}

      {projects.length === 0 ? (
        <div className="card text-slate-500 text-sm">
          You don't belong to any projects yet. Create one to get started — you'll be its admin.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`} className="card hover:ring-indigo-300 transition">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">{p.name}</h3>
                <span
                  className={`badge ${
                    p.my_role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {p.my_role}
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-1 line-clamp-2">{p.description || 'No description'}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
