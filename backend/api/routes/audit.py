"""
Audit Log API Routes
--------------------
GET  /api/audit-logs        — paginated event list (admin only)
GET  /api/audit-logs/stats  — category counts for the last 30 days
"""
import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, desc

from database.config import get_db
from database.models import AuditLog, User
from api.dependencies import get_current_user

router = APIRouter(prefix="/api/audit-logs", tags=["audit"])


def _require_admin(current_user: User) -> User:
    if current_user.role not in ("admin",):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("")
async def list_audit_logs(
    category: str | None = Query(None, description="Filter by category (AUTH, ANALYSIS, EXPORT, …)"),
    status:   str | None = Query(None, description="Filter by status (success, failure, warning)"),
    user_id:  str | None = Query(None, description="Filter by user_id"),
    limit:    int        = Query(100, ge=1, le=500),
    offset:   int        = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return paginated audit log events. Admin only."""
    _require_admin(current_user)

    q = select(AuditLog).order_by(desc(AuditLog.timestamp))

    if category:
        q = q.where(AuditLog.category == category.upper())
    if status:
        q = q.where(AuditLog.status == status.lower())
    if user_id:
        q = q.where(AuditLog.user_id == user_id)

    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar() or 0

    q = q.limit(limit).offset(offset)
    result = await db.execute(q)
    logs = result.scalars().all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "logs": [
            {
                "id":         log.id,
                "category":   log.category,
                "action":     log.action,
                "user_id":    log.user_id,
                "username":   log.username,
                "ip_address": log.ip_address,
                "status":     log.status,
                "details":    log.details,
                "timestamp":  log.timestamp,
            }
            for log in logs
        ],
    }


@router.get("/stats")
async def audit_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Category breakdown + status breakdown for the last 30 days."""
    _require_admin(current_user)

    cutoff = (datetime.datetime.utcnow() - datetime.timedelta(days=30)).isoformat()

    # Category counts
    cat_result = await db.execute(
        select(AuditLog.category, func.count(AuditLog.id))
        .where(AuditLog.timestamp >= cutoff)
        .group_by(AuditLog.category)
    )
    by_category = {row[0]: row[1] for row in cat_result.all()}

    # Status counts
    stat_result = await db.execute(
        select(AuditLog.status, func.count(AuditLog.id))
        .where(AuditLog.timestamp >= cutoff)
        .group_by(AuditLog.status)
    )
    by_status = {row[0]: row[1] for row in stat_result.all()}

    # Total last 30 days
    total_result = await db.execute(
        select(func.count(AuditLog.id)).where(AuditLog.timestamp >= cutoff)
    )
    total = total_result.scalar() or 0

    return {
        "period_days": 30,
        "total":       total,
        "by_category": by_category,
        "by_status":   by_status,
    }
