from datetime import timedelta
import datetime
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update as sql_update

from database.config import get_db, SessionLocal
from database.models import User
from models.auth import UserCreate, UserResponse, Token
from core.security import verify_password, get_password_hash, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from api.dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


async def _update_last_login(user_id: str):
    """Background task: update last_login_at without blocking the token response."""
    try:
        async with SessionLocal() as session:
            await session.execute(
                sql_update(User)
                .where(User.id == user_id)
                .values(last_login_at=datetime.datetime.utcnow().isoformat())
            )
            await session.commit()
    except Exception:
        pass  # Don't fail login if this update fails


@router.post("/register", response_model=UserResponse)
async def register_user(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    # Check if user exists
    result = await db.execute(select(User).filter(User.username == user_in.username))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Username already registered")
        
    result = await db.execute(select(User).filter(User.email == user_in.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")
        
    # Every self-registered user is system-level admin.
    # The analyst distinction is managed at the GROUP level (GroupMembership.role),
    # not at the system level. An admin can demote via /api/admin/users if needed.
    assigned_role = "admin"

    hashed_password = get_password_hash(user_in.password)
    new_user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=hashed_password,
        full_name=getattr(user_in, 'full_name', None),
        role=assigned_role,
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return new_user


@router.post("/token", response_model=Token)
async def login_for_access_token(
    background_tasks: BackgroundTasks,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    # Accept login by username OR email
    result = await db.execute(select(User).filter(User.username == form_data.username))
    user = result.scalars().first()

    if not user:
        # Try by email
        result = await db.execute(select(User).filter(User.email == form_data.username))
        user = result.scalars().first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Update last_login_at in the background (non-blocking)
    background_tasks.add_task(_update_last_login, user.id)
        
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role or "analyst"}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
