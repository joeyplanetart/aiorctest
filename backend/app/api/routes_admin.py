from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_superadmin
from app.db.models import User
from app.schemas.auth import UserAdminOut, UserAdminPatch, UserProfile

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/users", response_model=list[UserAdminOut])
def list_all_users(
    _: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return users


@router.patch("/users/{user_id}", response_model=UserProfile)
def patch_user_admin(
    user_id: str,
    body: UserAdminPatch,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    superadmin_count = db.query(User).filter(User.is_superadmin.is_(True)).count()

    if body.is_superadmin is False and user.is_superadmin and superadmin_count <= 1:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Cannot remove superadmin from the only superadmin account",
        )

    if body.is_active is False and user.id == current_user.id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Cannot deactivate your own account",
        )

    if body.is_active is False and user.is_superadmin and superadmin_count <= 1:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Cannot deactivate the only superadmin account",
        )

    if body.is_superadmin is not None:
        user.is_superadmin = body.is_superadmin
    if body.is_active is not None:
        user.is_active = body.is_active

    db.commit()
    db.refresh(user)
    return user
