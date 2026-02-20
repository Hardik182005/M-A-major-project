from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.auth.service import get_current_user
from app.models.user import User
from app.models.project_member import ProjectMember


def require_project_role(allowed_roles: list[str]):
    """
    Returns a FastAPI dependency that checks the current user
    is a member of the project with one of the allowed roles.

    Usage in route:
        @router.get("/projects/{project_id}/something")
        def my_endpoint(
            project_id: int,
            member: ProjectMember = Depends(require_project_role(["ADMIN", "ANALYST"])),
        ):
            ...
    """

    def dependency(
        project_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> ProjectMember:
        member = (
            db.query(ProjectMember)
            .filter(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == current_user.id,
            )
            .first()
        )
        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this project",
            )
        if member.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{member.role}' is not allowed. Required: {allowed_roles}",
            )
        return member

    return dependency
