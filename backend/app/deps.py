from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import Membership, Project, Role, User
from .security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    creds_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    if not payload:
        raise creds_exc
    sub = payload.get("sub")
    if not sub:
        raise creds_exc
    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise creds_exc
    user = db.get(User, user_id)
    if not user:
        raise creds_exc
    return user


def get_project_or_404(project_id: int, db: Session = Depends(get_db)) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def get_membership(db: Session, user_id: int, project_id: int) -> Membership | None:
    return (
        db.query(Membership)
        .filter(Membership.user_id == user_id, Membership.project_id == project_id)
        .one_or_none()
    )


def require_member(
    project: Project = Depends(get_project_or_404),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Membership:
    membership = get_membership(db, user.id, project.id)
    if not membership:
        # Members cannot access projects they don't belong to
        raise HTTPException(status_code=403, detail="You are not a member of this project")
    return membership


def require_admin(membership: Membership = Depends(require_member)) -> Membership:
    if membership.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Admin role required for this action")
    return membership
