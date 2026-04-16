from pydantic import BaseModel, EmailStr
from typing import Optional

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: str
    is_active: bool
    role: Optional[str] = "analyst"

    class Config:
        from_attributes = True

class UserProfile(BaseModel):
    """Full user profile including optional extended fields."""
    id: str
    username: str
    email: str
    is_active: bool
    full_name: Optional[str] = None
    bio: Optional[str] = None
    role: Optional[str] = "analyst"
    organization: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: Optional[str] = None
    last_login_at: Optional[str] = None

    class Config:
        from_attributes = True

class UserProfileUpdate(BaseModel):
    """Fields the user is allowed to update on their own profile."""
    full_name: Optional[str] = None
    bio: Optional[str] = None
    organization: Optional[str] = None
    avatar_url: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
