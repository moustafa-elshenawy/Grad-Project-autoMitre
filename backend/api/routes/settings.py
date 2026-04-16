"""
OSINT Settings API — read and write runtime OSINT configuration.
Allows users to configure MISP URL/key and OTX key from the frontend
without editing environment files.
"""
import os
from fastapi import APIRouter, Depends
from typing import Optional
from pydantic import BaseModel

from api.dependencies import get_current_user, require_admin
from database.models import User
from core.osint_client import update_runtime_config, RUNTIME_CONFIG, get_source_status
import core.osint_client as osint_client

router = APIRouter(prefix="/api/settings", tags=["settings"])


class OsintConfigUpdate(BaseModel):
    misp_url: Optional[str] = None
    misp_api_key: Optional[str] = None
    otx_api_key: Optional[str] = None
    virustotal_api_key: Optional[str] = None
    osint_limit: Optional[int] = None
    osint_min_severity: Optional[str] = None
    osint_store_locally: Optional[bool] = None
    framework_attack: Optional[bool] = None
    framework_defend: Optional[bool] = None
    framework_nist: Optional[bool] = None
    framework_owasp: Optional[bool] = None


@router.get("/osint")
async def get_osint_config(current_user: User = Depends(get_current_user)):
    """Return current OSINT settings (keys are masked for security)."""
    misp_key = RUNTIME_CONFIG.get("misp_api_key") or osint_client.MISP_API_KEY
    otx_key  = RUNTIME_CONFIG.get("otx_api_key")  or osint_client.OTX_API_KEY
    misp_url = RUNTIME_CONFIG.get("misp_url")     or osint_client.MISP_URL
    vt_key   = RUNTIME_CONFIG.get("virustotal_api_key") or os.environ.get("VIRUSTOTAL_API_KEY", "")
    osint_limit = RUNTIME_CONFIG.get("osint_limit", 50)
    osint_min_severity = RUNTIME_CONFIG.get("osint_min_severity", "Low")
    osint_store_locally = str(RUNTIME_CONFIG.get("osint_store_locally", "False")).lower() == "true"
    
    framework_attack = str(RUNTIME_CONFIG.get("framework_attack", "True")).lower() == "true"
    framework_defend = str(RUNTIME_CONFIG.get("framework_defend", "True")).lower() == "true"
    framework_nist = str(RUNTIME_CONFIG.get("framework_nist", "True")).lower() == "true"
    framework_owasp = str(RUNTIME_CONFIG.get("framework_owasp", "True")).lower() == "true"

    def mask(s: str) -> str:
        if not s or len(s) < 8:
            return "••••••••" if s else ""
        return s[:4] + "••••" + s[-4:]

    return {
        "misp_url":     misp_url or "",
        "misp_api_key": mask(misp_key),
        "misp_configured": bool(misp_url and misp_key),
        "otx_api_key":  mask(otx_key),
        "otx_configured": bool(otx_key),
        "virustotal_api_key": mask(vt_key),
        "virustotal_configured": bool(vt_key),
        "osint_limit": int(osint_limit),
        "osint_min_severity": osint_min_severity,
        "osint_store_locally": osint_store_locally,
        "framework_attack": framework_attack,
        "framework_defend": framework_defend,
        "framework_nist": framework_nist,
        "framework_owasp": framework_owasp,
        "sources": get_source_status(),
    }


@router.patch("/osint")
async def update_osint_config(
    config: OsintConfigUpdate,
    current_user: User = Depends(require_admin),
):
    """Update runtime OSINT configuration (Admin only). Persists until server restart.
    
    For permanent storage, set via environment variables.
    Values that are empty strings are treated as 'clear this setting'.
    """
    updated = []

    if config.misp_url is not None:
        update_runtime_config("misp_url", config.misp_url)
        updated.append("misp_url")

    if config.misp_api_key is not None and "••••" not in config.misp_api_key:
        # Only update if it's not the masked placeholder
        update_runtime_config("misp_api_key", config.misp_api_key)
        updated.append("misp_api_key")

    if config.otx_api_key is not None and "••••" not in config.otx_api_key:
        update_runtime_config("otx_api_key", config.otx_api_key)
        updated.append("otx_api_key")

    if config.virustotal_api_key is not None and "••••" not in config.virustotal_api_key:
        update_runtime_config("virustotal_api_key", config.virustotal_api_key)
        updated.append("virustotal_api_key")

    if config.osint_limit is not None:
        update_runtime_config("osint_limit", config.osint_limit)
        updated.append("osint_limit")

    if config.osint_min_severity is not None:
        update_runtime_config("osint_min_severity", config.osint_min_severity)
        updated.append("osint_min_severity")

    if config.osint_store_locally is not None:
        update_runtime_config("osint_store_locally", str(config.osint_store_locally).lower())
        updated.append("osint_store_locally")

    if config.framework_attack is not None:
        update_runtime_config("framework_attack", str(config.framework_attack).lower())
        updated.append("framework_attack")
        
    if config.framework_defend is not None:
        update_runtime_config("framework_defend", str(config.framework_defend).lower())
        updated.append("framework_defend")
        
    if config.framework_nist is not None:
        update_runtime_config("framework_nist", str(config.framework_nist).lower())
        updated.append("framework_nist")
        
    if config.framework_owasp is not None:
        update_runtime_config("framework_owasp", str(config.framework_owasp).lower())
        updated.append("framework_owasp")

    return {
        "updated": updated,
        "sources": get_source_status(),
    }
