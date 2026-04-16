"""
Admin Routes — User management endpoints restricted to administrators.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import Optional

from database.config import get_db
from database.models import User
from api.dependencies import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])

VALID_ROLES = {"admin", "analyst"}


class RoleUpdate(BaseModel):
    role: str


@router.get("/users")
async def list_all_users(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Return a list of all registered users (Admin only)."""
    result = await db.execute(select(User))
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role or "analyst",
            "is_active": u.is_active,
            "full_name": u.full_name,
            "organization": u.organization,
            "created_at": u.created_at,
            "last_login_at": u.last_login_at,
        }
        for u in users
    ]


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    payload: RoleUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Change a user's role (Admin only). Valid roles: admin, analyst."""
    if payload.role not in VALID_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role '{payload.role}'. Valid roles: {', '.join(VALID_ROLES)}",
        )

    result = await db.execute(select(User).filter(User.id == user_id))
    target_user = result.scalars().first()

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Prevent an admin from demoting themselves (safety guard)
    if target_user.id == current_user.id and payload.role != "admin":
        raise HTTPException(
            status_code=400,
            detail="You cannot demote your own admin account.",
        )

    target_user.role = payload.role
    db.add(target_user)
    await db.commit()
    await db.refresh(target_user)

    return {
        "success": True,
        "user_id": user_id,
        "new_role": target_user.role,
        "message": f"User '{target_user.username}' role updated to '{payload.role}'.",
    }


@router.patch("/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Enable or disable a user account (Admin only)."""
    result = await db.execute(select(User).filter(User.id == user_id))
    target_user = result.scalars().first()

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account.")

    target_user.is_active = not target_user.is_active
    db.add(target_user)
    await db.commit()

    status = "activated" if target_user.is_active else "deactivated"
    return {"success": True, "user_id": user_id, "is_active": target_user.is_active, "message": f"User '{target_user.username}' {status}."}
