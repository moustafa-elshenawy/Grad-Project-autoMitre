"""
Groups API — Team workspace management.
Admins create groups, invite analysts, and manage membership.
Analysts can accept/deny invitations and view team data.
"""
import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, or_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional

from database.config import get_db
from database.models import Group, GroupMembership, GroupInvitation, User
from api.dependencies import get_current_user

router = APIRouter(prefix="/api/groups", tags=["groups"])


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None


class InviteRequest(BaseModel):
    identifier: str  # username or email of the person to invite


# ── Helpers ───────────────────────────────────────────────────────────────────

async def get_user_group(user_id: str, db: AsyncSession) -> Optional[GroupMembership]:
    """Return the user's current GroupMembership, if any."""
    result = await db.execute(
        select(GroupMembership).where(GroupMembership.user_id == user_id)
    )
    return result.scalars().first()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/")
async def create_group(
    payload: GroupCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new team workspace. The creator becomes the group admin."""
    existing = await get_user_group(current_user.id, db)
    if existing:
        raise HTTPException(
            status_code=400,
            detail="You are already a member of a group. Leave it first before creating a new one.",
        )

    group = Group(
        name=payload.name,
        description=payload.description,
        owner_id=current_user.id,
    )
    db.add(group)
    await db.flush()

    membership = GroupMembership(
        group_id=group.id,
        user_id=current_user.id,
        role="admin",
    )
    db.add(membership)
    await db.commit()
    await db.refresh(group)

    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "owner_id": group.owner_id,
        "created_at": group.created_at,
        "role": "admin",
    }


@router.get("/mine")
async def get_my_group(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user's group, membership list, and pending invitations."""
    membership = await get_user_group(current_user.id, db)
    if not membership:
        return {"group": None}

    group_result = await db.execute(select(Group).where(Group.id == membership.group_id))
    group = group_result.scalars().first()
    if not group:
        return {"group": None}

    # Eagerly load memberships + their users
    mem_result = await db.execute(
        select(GroupMembership)
        .options(selectinload(GroupMembership.user))
        .where(GroupMembership.group_id == group.id)
    )
    memberships = mem_result.scalars().all()

    # Eagerly load pending invitations + inviter
    inv_result = await db.execute(
        select(GroupInvitation)
        .options(selectinload(GroupInvitation.inviter))
        .where(and_(GroupInvitation.group_id == group.id, GroupInvitation.status == "pending"))
    )
    pending_invites = inv_result.scalars().all()

    return {
        "group": {
            "id": group.id,
            "name": group.name,
            "description": group.description,
            "owner_id": group.owner_id,
            "created_at": group.created_at,
        },
        "my_role": membership.role,
        "members": [
            {
                "user_id": m.user_id,
                "username": m.user.username if m.user else "Unknown",
                "full_name": m.user.full_name if m.user else None,
                "role": m.role,
                "joined_at": m.joined_at,
            }
            for m in memberships
        ],
        "pending_invitations": [
            {
                "id": inv.id,
                "invitee_identifier": inv.invitee_identifier,
                "inviter": inv.inviter.username if inv.inviter else "?",
                "created_at": inv.created_at,
            }
            for inv in pending_invites
        ] if membership.role == "admin" else [],
    }


@router.post("/{group_id}/invite")
async def invite_user(
    group_id: str,
    payload: InviteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invite a user to the group by username or email (Group admin only)."""
    mem_result = await db.execute(
        select(GroupMembership).where(
            and_(GroupMembership.group_id == group_id, GroupMembership.user_id == current_user.id)
        )
    )
    my_membership = mem_result.scalars().first()
    if not my_membership or my_membership.role != "admin":
        raise HTTPException(status_code=403, detail="Only group admins can send invitations.")

    result = await db.execute(
        select(User).where(or_(User.username == payload.identifier, User.email == payload.identifier))
    )
    invitee = result.scalars().first()

    if not invitee:
        raise HTTPException(status_code=404, detail=f"No user found with username/email '{payload.identifier}'.")
    if invitee.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot invite yourself.")

    existing_mem = await get_user_group(invitee.id, db)
    if existing_mem:
        raise HTTPException(status_code=400, detail=f"User '{invitee.username}' is already a member of a group.")

    existing_inv_result = await db.execute(
        select(GroupInvitation).where(
            and_(
                GroupInvitation.group_id == group_id,
                GroupInvitation.invitee_id == invitee.id,
                GroupInvitation.status == "pending",
            )
        )
    )
    if existing_inv_result.scalars().first():
        raise HTTPException(status_code=409, detail=f"A pending invitation already exists for '{invitee.username}'.")

    invitation = GroupInvitation(
        group_id=group_id,
        inviter_id=current_user.id,
        invitee_id=invitee.id,
        invitee_identifier=payload.identifier,
    )
    db.add(invitation)
    invitee_name = invitee.username  # capture before commit expires the object
    await db.commit()

    return {"success": True, "message": f"Invitation sent to '{invitee_name}'."}


@router.get("/invitations")
async def get_my_invitations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all pending invitations for the current user."""
    result = await db.execute(
        select(GroupInvitation)
        .options(selectinload(GroupInvitation.group), selectinload(GroupInvitation.inviter))
        .where(and_(GroupInvitation.invitee_id == current_user.id, GroupInvitation.status == "pending"))
    )
    invites = result.scalars().all()

    return {
        "invitations": [
            {
                "id": inv.id,
                "group_id": inv.group_id,
                "group_name": inv.group.name if inv.group else "Unknown",
                "inviter_username": inv.inviter.username if inv.inviter else "Unknown",
                "created_at": inv.created_at,
            }
            for inv in invites
        ],
        "count": len(invites),
    }


@router.post("/invitations/{invitation_id}/accept")
async def accept_invitation(
    invitation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Accept a group invitation."""
    result = await db.execute(select(GroupInvitation).where(GroupInvitation.id == invitation_id))
    inv = result.scalars().first()

    if not inv or inv.invitee_id != current_user.id:
        raise HTTPException(status_code=404, detail="Invitation not found.")
    if inv.status != "pending":
        raise HTTPException(status_code=400, detail=f"Invitation is already {inv.status}.")

    existing = await get_user_group(current_user.id, db)
    if existing:
        raise HTTPException(status_code=400, detail="You are already in a group. Leave it first.")

    membership = GroupMembership(group_id=inv.group_id, user_id=current_user.id, role="analyst")
    db.add(membership)
    inv.status = "accepted"
    joined_group_id = inv.group_id  # capture before commit expires the object
    db.add(inv)
    await db.commit()

    return {"success": True, "message": "You have joined the group.", "group_id": joined_group_id}


@router.post("/invitations/{invitation_id}/deny")
async def deny_invitation(
    invitation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deny a group invitation."""
    result = await db.execute(select(GroupInvitation).where(GroupInvitation.id == invitation_id))
    inv = result.scalars().first()

    if not inv or inv.invitee_id != current_user.id:
        raise HTTPException(status_code=404, detail="Invitation not found.")
    if inv.status != "pending":
        raise HTTPException(status_code=400, detail=f"Invitation is already {inv.status}.")

    inv.status = "denied"
    db.add(inv)
    await db.commit()

    return {"success": True, "message": "Invitation declined."}


@router.delete("/{group_id}/members/{user_id}")
async def remove_member(
    group_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member from the group (Group admin only)."""
    mem_result = await db.execute(
        select(GroupMembership).where(
            and_(GroupMembership.group_id == group_id, GroupMembership.user_id == current_user.id)
        )
    )
    my_mem = mem_result.scalars().first()
    if not my_mem or my_mem.role != "admin":
        raise HTTPException(status_code=403, detail="Only group admins can remove members.")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot remove yourself. Use 'leave group' instead.")

    target_result = await db.execute(
        select(GroupMembership).where(
            and_(GroupMembership.group_id == group_id, GroupMembership.user_id == user_id)
        )
    )
    target = target_result.scalars().first()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found in this group.")

    await db.delete(target)
    await db.commit()
    return {"success": True, "message": "Member removed from the group."}


@router.post("/leave")
async def leave_group(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Leave your current group."""
    membership = await get_user_group(current_user.id, db)
    if not membership:
        raise HTTPException(status_code=400, detail="You are not in any group.")

    if membership.role == "admin":
        admin_result = await db.execute(
            select(GroupMembership).where(
                and_(GroupMembership.group_id == membership.group_id, GroupMembership.role == "admin")
            )
        )
        admins = admin_result.scalars().all()
        if len(admins) == 1:
            raise HTTPException(
                status_code=400,
                detail="You are the only admin. Promote another member to admin before leaving, or delete the group.",
            )

    await db.delete(membership)
    await db.commit()
    return {"success": True, "message": "You have left the group."}


@router.delete("/{group_id}")
async def delete_group(
    group_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete the entire group (owner only)."""
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalars().first()

    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")
    if group.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the group owner can delete the group.")

    await db.delete(group)
    await db.commit()
    return {"success": True, "message": "Group deleted."}


@router.patch("/{group_id}/members/{user_id}/role")
async def change_member_role(
    group_id: str,
    user_id: str,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change a group member's role (admin only)."""
    new_role = payload.get("role")
    if new_role not in ("admin", "analyst"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'analyst'.")

    my_mem_result = await db.execute(
        select(GroupMembership).where(
            and_(GroupMembership.group_id == group_id, GroupMembership.user_id == current_user.id)
        )
    )
    my_mem = my_mem_result.scalars().first()
    if not my_mem or my_mem.role != "admin":
        raise HTTPException(status_code=403, detail="Only group admins can change roles.")

    target_result = await db.execute(
        select(GroupMembership).where(
            and_(GroupMembership.group_id == group_id, GroupMembership.user_id == user_id)
        )
    )
    target = target_result.scalars().first()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found.")

    target.role = new_role
    db.add(target)
    await db.commit()
    return {"success": True, "new_role": new_role}
