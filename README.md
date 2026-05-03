# Team Task Manager

Full-stack app for teams to create projects, assign tasks, and track progress with role-based access (Admin / Member per project).

- **Backend** — FastAPI + SQLAlchemy + PostgreSQL, JWT auth (`python-jose`)
- **Frontend** — React + Vite + Tailwind CSS, React Router
- **Deploy** — Railway (separate `api` and `web` services, Postgres plugin)

---

## Features

- Email/password signup and login (JWT)
- Per-project roles: **Admin** and **Member**
- Project + team management (a project IS a team)
- Tasks with title, description, status (Todo / In Progress / Done), priority (Low / Medium / High), due date, single assignee
- Personal dashboard: my tasks, status counts, overdue
- Per-project stats: total / completed / pending / overdue

### Role rules

| Action                          | Admin | Member |
|---------------------------------|:-----:|:------:|
| Create project                  | n/a — any logged-in user can create a project (and becomes its Admin) ||
| Delete / rename project         |  ✅   |   ❌   |
| Add / remove members            |  ✅   |   ❌   |
| Change a member's role          |  ✅   |   ❌   |
| Create tasks                    |  ✅   |   ❌   |
| Assign / reassign tasks         |  ✅   |   ❌   |
| Edit task title/desc/due/etc.   |  ✅   |   ❌   |
| Delete task                     |  ✅   |   ❌   |
| View project + its members      |  ✅   |   ✅   |
| View tasks                      | all   | only tasks assigned to them |
| Update **status** of own task   |  ✅   |   ✅ (only their assigned tasks) |
| Access projects they don't belong to | ❌ | ❌ |

> **Design note** — "Members cannot create projects" is interpreted as a within-a-project rule: members of project X can't perform admin actions on X. Any authenticated user can still create new projects of their own (and becomes Admin of the project they create). This matches how Trello / Asana / Linear work and avoids a separate system-wide-admin concept. If you want a strict system-admin model instead, see "Alternative role model" at the bottom.

---

## Local development

### Prerequisites
- Python 3.11+ (tested on 3.14)
- Node 18+
- PostgreSQL for production. SQLite is only a local-development fallback when `ENVIRONMENT` is not `production`.

### Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1            # PowerShell
# .venv\Scripts\activate              # cmd
# source .venv/bin/activate           # bash
pip install -r requirements.txt
copy .env.example .env                # then edit JWT_SECRET, DATABASE_URL
uvicorn app.main:app --reload --port 8000
```

API docs: <http://localhost:8000/docs>

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api/*` to `http://localhost:8000`, so no CORS config is needed in dev.

### Smoke test (backend only)

With the backend running on port `8765`, the included script exercises auth, RBAC, tasks, and dashboard end-to-end:

```bash
cd backend
DATABASE_URL=sqlite:///./smoke.db JWT_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
  .venv/Scripts/python.exe -m uvicorn app.main:app --port 8765 &
bash smoke_test.sh
```

---

## Project structure

```
backend/
  app/
    main.py            FastAPI app + CORS + DB bootstrap
    config.py          pydantic-settings (env vars)
    database.py        SQLAlchemy engine, session, Base
    models.py          User, Project, Membership, Task
    schemas.py         Pydantic request/response models
    security.py        bcrypt password hashing + JWT helpers
    deps.py            FastAPI deps: current user, RBAC guards
    routers/
      auth.py          POST /api/auth/{signup,login}, GET /api/auth/me
      projects.py      /api/projects + /members
      tasks.py         /api/tasks + /api/projects/{id}/tasks + /stats
      dashboard.py     GET /api/dashboard
  requirements.txt
  Procfile             web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
  railway.json
  smoke_test.sh

frontend/
  src/
    main.jsx, App.jsx
    auth.jsx           AuthProvider (JWT in localStorage)
    api.js             axios client w/ Authorization header
    components/        Navbar, ProtectedRoute, TaskBadges
    pages/             Login, Signup, Dashboard, Projects, ProjectDetail
    index.css          Tailwind layers + small component classes
  vite.config.js       proxy /api → :8000 in dev
  package.json, tailwind.config.js, postcss.config.js, railway.json

RAILWAY.md             step-by-step deploy guide
```

---

## REST API summary

All endpoints (except `/api/auth/signup` and `/api/auth/login`) require `Authorization: Bearer <jwt>`.

### Auth
- `POST /api/auth/signup` — `{ email, full_name, password }` → `{ access_token, user }`
- `POST /api/auth/login`  — `{ email, password }` → `{ access_token, user }`
- `GET  /api/auth/me`     → current user

### Projects
- `GET  /api/projects` — list of projects you belong to (with `my_role`)
- `POST /api/projects` — `{ name, description? }` (creator becomes Admin)
- `GET  /api/projects/{id}` — detail incl. members (member-only)
- `PATCH /api/projects/{id}` — admin only
- `DELETE /api/projects/{id}` — admin only

### Members
- `GET  /api/projects/{id}/members`
- `POST /api/projects/{id}/members` — `{ email, role }` (admin only)
- `PATCH /api/projects/{id}/members/{user_id}` — `{ role }` (admin only; can't demote last admin)
- `DELETE /api/projects/{id}/members/{user_id}` — admin only

### Tasks
- `GET  /api/projects/{id}/tasks` — admins see all; members see only their assigned ones
- `POST /api/projects/{id}/tasks` — admin only
- `GET  /api/projects/{id}/stats` — total / completed / pending / overdue
- `GET  /api/tasks/{id}`
- `PATCH /api/tasks/{id}` — admin only (full edit)
- `PATCH /api/tasks/{id}/status` — `{ status }` — assignee or admin
- `DELETE /api/tasks/{id}` — admin only

### Dashboard
- `GET /api/dashboard` — `{ my_tasks, status_counts, overdue_count, overdue_tasks }`

Full OpenAPI/Swagger UI at `/docs`.

---

## Deployment

Production requires:

- `ENVIRONMENT=production`
- `DATABASE_URL` set to the Railway PostgreSQL connection URL
- `JWT_SECRET` set to a long random value
- `CORS_ORIGINS` set to the deployed frontend origin

The backend refuses to start in production if `DATABASE_URL` is missing or does not point to PostgreSQL.

See **[RAILWAY.md](./RAILWAY.md)** for the step-by-step guide.

---

## Alternative role model

If you really want "Members cannot create projects" to mean a **system-wide** restriction (only system admins can create projects), the change is small:

1. Add `is_system_admin: bool = False` on `User`.
2. Gate `POST /api/projects` on that flag.
3. Bootstrap the first admin via a one-off script or env-var-driven flag.

This is not implemented in the MVP because the assignment also says role is "per project", which is incompatible with a global role unless you bolt on a second concept.
