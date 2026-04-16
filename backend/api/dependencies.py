from fastapi import Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel

from database.config import get_db
from database.models import User
from core.security import SECRET_KEY, ALGORITHM
from models.auth import TokenData

class WorkspaceState(BaseModel):
    group_id: str | None
    view_mode: str
    group_role: str | None = None

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
        
    result = await db.execute(select(User).filter(User.username == token_data.username))
    user = result.scalars().first()
    
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    return user


async def get_workspace(
    view: str | None = Query(default="both", description="'personal', 'team', or 'both'"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceState:
    """
    Resolve the workspace context for the current user.
    """
    from sqlalchemy.future import select as sa_select
    from database.models import GroupMembership
    result = await db.execute(sa_select(GroupMembership).where(GroupMembership.user_id == current_user.id))
    membership = result.scalars().first()
    
    group_id = membership.group_id if membership else None
    group_role = membership.role if membership else None
    
    # If the user has no group, they are inherently in personal mode only
    if not group_id:
        view = "personal"
        
    active_group_id = None if view == "personal" else group_id
    
    return WorkspaceState(group_id=active_group_id, view_mode=view or "both", group_role=group_role)

async def require_admin(current_user: User = Depends(get_current_user), workspace: WorkspaceState = Depends(get_workspace)):
    """Dependency that blocks non-admin users with HTTP 403 based on their active workspace contextual role."""
    is_admin = False
    
    # In personal mode, users act as their own sandbox admin.
    if workspace.view_mode == "personal":
        is_admin = True
    # In team or both mode, they must be a group admin.
    elif workspace.view_mode in ["team", "both"] and workspace.group_role == "admin":
        is_admin = True
        
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required for this operation in the current workspace mode. Switch to Private mode or request team admin privileges.",
        )
    return current_user
