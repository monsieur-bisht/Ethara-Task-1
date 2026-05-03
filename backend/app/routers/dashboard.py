from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import get_current_user
from ..models import Task, TaskStatus, User
from ..schemas import DashboardOut, StatusCounts, TaskOut

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _is_overdue(due_date: datetime | None, status: TaskStatus, now: datetime) -> bool:
    if due_date is None or status == TaskStatus.DONE:
        return False
    # SQLite drops tz info; treat naive timestamps as UTC.
    if due_date.tzinfo is None:
        due_date = due_date.replace(tzinfo=timezone.utc)
    return due_date < now


@router.get("", response_model=DashboardOut)
def get_dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DashboardOut:
    tasks = (
        db.query(Task)
        .options(joinedload(Task.assignee), joinedload(Task.creator))
        .filter(Task.assignee_id == user.id)
        .order_by(Task.due_date.asc().nulls_last(), Task.created_at.desc())
        .all()
    )
    counts = StatusCounts()
    overdue: list[Task] = []
    now = datetime.now(timezone.utc)
    for t in tasks:
        if t.status == TaskStatus.TODO:
            counts.todo += 1
        elif t.status == TaskStatus.IN_PROGRESS:
            counts.in_progress += 1
        elif t.status == TaskStatus.DONE:
            counts.done += 1
        if _is_overdue(t.due_date, t.status, now):
            overdue.append(t)
    return DashboardOut(
        my_tasks=[TaskOut.model_validate(t) for t in tasks],
        status_counts=counts,
        overdue_count=len(overdue),
        overdue_tasks=[TaskOut.model_validate(t) for t in overdue],
    )
