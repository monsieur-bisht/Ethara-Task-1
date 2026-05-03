const STATUS_STYLES = {
  TODO: 'bg-slate-100 text-slate-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  DONE: 'bg-green-100 text-green-700',
}
const STATUS_LABELS = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
}
const PRIORITY_STYLES = {
  LOW: 'bg-slate-100 text-slate-700',
  MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-red-100 text-red-700',
}

export function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status] || status}</span>
}

export function PriorityBadge({ priority }) {
  return <span className={`badge ${PRIORITY_STYLES[priority]}`}>{priority}</span>
}

export function isOverdue(task) {
  if (!task.due_date || task.status === 'DONE') return false
  return new Date(task.due_date) < new Date()
}

export function formatDue(due) {
  if (!due) return '—'
  return new Date(due).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
