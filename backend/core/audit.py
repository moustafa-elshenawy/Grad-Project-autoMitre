"""
core/audit.py — Global Audit Logging Engine
============================================
Provides a single `log_event()` async helper that any route can call
(as a BackgroundTask or directly) to persist a structured audit record.

Uses stdlib sqlite3 via a thread-pool executor to avoid SQLAlchemy
greenlet conflicts that occur when creating a new AsyncSession inside
a FastAPI BackgroundTask.

Event Categories:
  AUTH        — login, logout, register, token refresh
  ANALYSIS    — threat analysis runs (text, hash, file, PCAP)
  EXPORT      — every export (STIX, JSON, CSV, PDF, Splunk)
  SETTINGS    — configuration changes
  USER        — profile updates, password changes
  TEAM        — group create/join/leave/invite/remove
  ADMIN       — user role changes, deletions
  THREAT      — threat record delete, save, view
"""
from __future__ import annotations

import asyncio
import datetime
import json
import logging
import os
import sqlite3
import uuid
from typing import Optional

logger = logging.getLogger(__name__)

# Resolve the database path at import time (matches database/config.py logic)
_THIS_DIR = os.path.dirname(__file__)
_DB_PATH = os.path.normpath(os.path.join(_THIS_DIR, "..", "automitre.db"))


def _write_log_sync(
    record_id: str,
    category: str,
    action: str,
    user_id: Optional[str],
    username: Optional[str],
    ip_address: Optional[str],
    status: str,
    details: dict,
    timestamp: str,
) -> None:
    """
    Synchronous sqlite3 write — runs in a thread-pool executor.
    The audit_logs table is created by SQLAlchemy's create_all on startup,
    so we can be confident it exists by the time any route is called.
    """
    try:
        conn = sqlite3.connect(_DB_PATH, timeout=5)
        conn.execute(
            """
            INSERT INTO audit_logs
                (id, category, action, user_id, username, ip_address,
                 status, details, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record_id,
                category,
                action,
                user_id,
                username,
                ip_address,
                status,
                json.dumps(details or {}),
                timestamp,
            ),
        )
        conn.commit()
        conn.close()
    except Exception as exc:
        # Audit logging must NEVER crash a business request
        logger.error(f"[AuditLog] Failed to write event '{action}': {exc}")


async def log_event(
    *,
    category: str,
    action: str,
    user_id: Optional[str] = None,
    username: Optional[str] = None,
    ip_address: Optional[str] = None,
    status: str = "success",          # success | failure | warning
    details: Optional[dict] = None,   # any extra JSON payload
) -> None:
    """
    Fire-and-forget audit event writer.
    Safe to call from a FastAPI BackgroundTask — never raises.
    Runs the actual sqlite3 write in a thread-pool to keep the event loop free.
    """
    record_id = str(uuid.uuid4())
    timestamp = datetime.datetime.utcnow().isoformat()

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None,
        _write_log_sync,
        record_id,
        category.upper(),
        action,
        user_id,
        username,
        ip_address,
        status,
        details or {},
        timestamp,
    )
