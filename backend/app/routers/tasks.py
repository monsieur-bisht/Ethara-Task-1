from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import (
    get_current_user,
    get_membership,
    get_project_or_404,
    require_admin,
    require_member,
)
from ..models import Membership, Project, Role, Task, User
from ..schemas import (
    ProjectStatsOut,
    StatusCounts,
    TaskCreate,
    TaskOut,
    TaskStatus,
    TaskStatusUpdate,
    TaskUpdate,
)

router = APIRouter(tags=["tasks"])


def _ensure_assignee_in_project(db: Session, project_id: int, assignee_id: int) -> User:
    user = db.get(User, assignee_id)
    if not user:
        raise HTTPException(status_code=404, detail="Assignee user not found")
    if not get_membership(db, assignee_id, project_id):
        raise HTTPException(status_code=400, detail="Assignee is not a member of this project")
    return user


# ---------- list / create within a project ----------
@router.get("/api/projects/{project_id}/tasks", response_model=list[TaskOut])
def list_project_tasks(
    project: Project = Depends(get_project_or_404),
    membership: Membership = Depends(require_member),
    db: Session = Depends(get_db),
) -> list[TaskOut]:
    q = (
        db.query(Task)
        .options(joinedload(Task.assignee), joinedload(Task.creator))
        .filter(Task.project_id == project.id)
    )
    # Members only see tasks assigned to them; Admins see all.
    if membership.role != Role.ADMIN:
        q = q.filter(Task.assignee_id == membership.user_id)
    return [TaskOut.model_validate(t) for t in q.order_by(Task.created_at.desc()).all()]


@router.post(
    "/api/projects/{project_id}/tasks",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
)
def create_task(
    payload: TaskCreate,
    project: Project = Depends(get_project_or_404),
    _: Membership = Depends(require_admin),  # only Admins create tasks
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskOut:
    assignee_id = payload.assignee_id
    if assignee_id is not None:
        _ensure_assignee_in_project(db, project.id, assignee_id)
    task = Task(
        title=payload.title.strip(),
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        due_date=payload.due_date,
        project_id=project.id,
        assignee_id=assignee_id,
        creator_id=current_user.id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task)


# ---------- project-level stats ----------
@router.get("/api/projects/{project_id}/stats", response_model=ProjectStatsOut)
def project_stats(
    project: Project = Depends(get_project_or_404),
    _: Membership = Depends(require_member),
    db: Session = Depends(get_db),
) -> ProjectStatsOut:
    from datetime import datetime, timezone

    tasks = db.query(Task).filter(Task.project_id == project.id).all()
    counts = StatusCounts()
    overdue = 0
    now = datetime.now(timezone.utc)
    for t in tasks:
        if t.status == TaskStatus.TODO:
            counts.todo += 1
        elif t.status == TaskStatus.IN_PROGRESS:
            counts.in_progress += 1
        elif t.status == TaskStatus.DONE:
            counts.done += 1
        due = t.due_date
        if due is not None and due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
        if due is not None and due < now and t.status != TaskStatus.DONE:
            overdue += 1
    return ProjectStatsOut(
        total=len(tasks),
        completed=counts.done,
        pending=counts.todo + counts.in_progress,
        overdue=overdue,
        status_counts=counts,
    )


# ---------- single task ----------
def _get_task_or_404(db: Session, task_id: int) -> Task:
    task = (
        db.query(Task)
        .options(joinedload(Task.assignee), joinedload(Task.creator))
        .filter(Task.id == task_id)
        .one_or_none()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/api/tasks/{task_id}", response_model=TaskOut)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TaskOut:
    task = _get_task_or_404(db, task_id)
    membership = get_membership(db, user.id, task.project_id)
    if not membership:
        raise HTTPException(status_code=403, detail="You are not a member of this project")
    if membership.role != Role.ADMIN and task.assignee_id != user.id:
        raise HTTPException(status_code=403, detail="Members can only view tasks assigned to them")
    return TaskOut.model_validate(task)


@router.patch("/api/tasks/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TaskOut:
    task = _get_task_or_404(db, task_id)
    membership = get_membership(db, user.id, task.project_id)
    if not membership:
        raise HTTPException(status_code=403, detail="You are not a member of this project")
    if membership.role != Role.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only admins can edit tasks. Members can update task status via PATCH /tasks/{id}/status.",
        )
    if payload.assignee_id is not None:
        _ensure_assignee_in_project(db, task.project_id, payload.assignee_id)
        task.assignee_id = payload.assignee_id
    if payload.title is not None:
        task.title = payload.title.strip()
    if payload.description is not None:
        task.description = payload.description
    if payload.status is not None:
        task.status = payload.status
    if payload.priority is not None:
        task.priority = payload.priority
    if payload.due_date is not None:
        task.due_date = payload.due_date
    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task)


@router.patch("/api/tasks/{task_id}/status", response_model=TaskOut)
def update_task_status(
    task_id: int,
    payload: TaskStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TaskOut:
    """Members can update status of their own assigned tasks; admins can update any."""
    task = _get_task_or_404(db, task_id)
    membership = get_membership(db, user.id, task.project_id)
    if not membership:
        raise HTTPException(status_code=403, detail="You are not a member of this project")
    if membership.role != Role.ADMIN and task.assignee_id != user.id:
        raise HTTPException(status_code=403, detail="You can only update status of tasks assigned to you")
    task.status = payload.status
    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task)


@router.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    task = _get_task_or_404(db, task_id)
    membership = get_membership(db, user.id, task.project_id)
    if not membership or membership.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Only project admins can delete tasks")
    db.delete(task)
    db.commit()
