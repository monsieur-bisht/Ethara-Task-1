from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .models import Role, TaskPriority, TaskStatus


# ---------- auth ----------
class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8, max_length=1024)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- projects ----------
class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class MemberOut(BaseModel):
    user: UserOut
    role: Role
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectOut(BaseModel):
    id: int
    name: str
    description: str | None
    created_at: datetime
    my_role: Role

    model_config = ConfigDict(from_attributes=True)


class ProjectDetailOut(ProjectOut):
    members: list[MemberOut]


class MemberAdd(BaseModel):
    email: EmailStr
    role: Role = Role.MEMBER


class MemberRoleUpdate(BaseModel):
    role: Role


# ---------- tasks ----------
class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: datetime | None = None
    assignee_id: int | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_date: datetime | None = None
    assignee_id: int | None = None


class TaskStatusUpdate(BaseModel):
    status: TaskStatus


class TaskOut(BaseModel):
    id: int
    title: str
    description: str | None
    status: TaskStatus
    priority: TaskPriority
    due_date: datetime | None
    project_id: int
    assignee: UserOut | None
    creator: UserOut | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------- dashboard ----------
class StatusCounts(BaseModel):
    todo: int = 0
    in_progress: int = 0
    done: int = 0


class DashboardOut(BaseModel):
    my_tasks: list[TaskOut]
    status_counts: StatusCounts
    overdue_count: int
    overdue_tasks: list[TaskOut]


class ProjectStatsOut(BaseModel):
    total: int
    completed: int
    pending: int
    overdue: int
    status_counts: StatusCounts
