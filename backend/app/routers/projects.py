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
from ..models import Membership, Project, Role, User
from ..schemas import (
    MemberAdd,
    MemberOut,
    MemberRoleUpdate,
    ProjectCreate,
    ProjectDetailOut,
    ProjectOut,
    ProjectUpdate,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _to_project_out(project: Project, role: Role) -> ProjectOut:
    return ProjectOut(
        id=project.id,
        name=project.name,
        description=project.description,
        created_at=project.created_at,
        my_role=role,
    )


@router.get("", response_model=list[ProjectOut])
def list_my_projects(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[ProjectOut]:
    rows = (
        db.query(Membership)
        .options(joinedload(Membership.project))
        .filter(Membership.user_id == user.id)
        .all()
    )
    return [_to_project_out(m.project, m.role) for m in rows]


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectOut:
    # Any authenticated user may create a project; they become its Admin.
    project = Project(name=payload.name.strip(), description=payload.description)
    db.add(project)
    db.flush()
    membership = Membership(user_id=user.id, project_id=project.id, role=Role.ADMIN)
    db.add(membership)
    db.commit()
    db.refresh(project)
    return _to_project_out(project, Role.ADMIN)


@router.get("/{project_id}", response_model=ProjectDetailOut)
def get_project(
    project: Project = Depends(get_project_or_404),
    membership: Membership = Depends(require_member),
    db: Session = Depends(get_db),
) -> ProjectDetailOut:
    members = (
        db.query(Membership)
        .options(joinedload(Membership.user))
        .filter(Membership.project_id == project.id)
        .all()
    )
    return ProjectDetailOut(
        id=project.id,
        name=project.name,
        description=project.description,
        created_at=project.created_at,
        my_role=membership.role,
        members=[MemberOut.model_validate(m) for m in members],
    )


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    payload: ProjectUpdate,
    project: Project = Depends(get_project_or_404),
    membership: Membership = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ProjectOut:
    if payload.name is not None:
        project.name = payload.name.strip()
    if payload.description is not None:
        project.description = payload.description
    db.commit()
    db.refresh(project)
    return _to_project_out(project, membership.role)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project: Project = Depends(get_project_or_404),
    _: Membership = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    db.delete(project)
    db.commit()


# ---------- members ----------
@router.get("/{project_id}/members", response_model=list[MemberOut])
def list_members(
    project: Project = Depends(get_project_or_404),
    _: Membership = Depends(require_member),
    db: Session = Depends(get_db),
) -> list[MemberOut]:
    members = (
        db.query(Membership)
        .options(joinedload(Membership.user))
        .filter(Membership.project_id == project.id)
        .all()
    )
    return [MemberOut.model_validate(m) for m in members]


@router.post("/{project_id}/members", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
def add_member(
    payload: MemberAdd,
    project: Project = Depends(get_project_or_404),
    _: Membership = Depends(require_admin),
    db: Session = Depends(get_db),
) -> MemberOut:
    user = db.query(User).filter(User.email == payload.email.lower()).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="No user found with that email")
    existing = get_membership(db, user.id, project.id)
    if existing:
        raise HTTPException(status_code=409, detail="User is already a member of this project")
    membership = Membership(user_id=user.id, project_id=project.id, role=payload.role)
    db.add(membership)
    db.commit()
    db.refresh(membership)
    return MemberOut.model_validate(membership)


@router.patch("/{project_id}/members/{user_id}", response_model=MemberOut)
def update_member_role(
    user_id: int,
    payload: MemberRoleUpdate,
    project: Project = Depends(get_project_or_404),
    _: Membership = Depends(require_admin),
    db: Session = Depends(get_db),
) -> MemberOut:
    target = get_membership(db, user_id, project.id)
    if not target:
        raise HTTPException(status_code=404, detail="Membership not found")
    if payload.role != Role.ADMIN and target.role == Role.ADMIN:
        # prevent removing the last admin
        admin_count = (
            db.query(Membership)
            .filter(Membership.project_id == project.id, Membership.role == Role.ADMIN)
            .count()
        )
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot demote the last admin of the project")
    target.role = payload.role
    db.commit()
    db.refresh(target)
    return MemberOut.model_validate(target)


@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    user_id: int,
    project: Project = Depends(get_project_or_404),
    _: Membership = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    target = get_membership(db, user_id, project.id)
    if not target:
        raise HTTPException(status_code=404, detail="Membership not found")
    if target.role == Role.ADMIN:
        admin_count = (
            db.query(Membership)
            .filter(Membership.project_id == project.id, Membership.role == Role.ADMIN)
            .count()
        )
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the last admin of the project")
    db.delete(target)
    db.commit()
