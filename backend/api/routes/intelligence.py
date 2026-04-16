"""
Intelligence API Routes
Handles chat, dashboard stats, and threat feed.
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
import asyncio
import random

from models.schemas import ChatRequest, ChatResponse, DashboardStats
from core.ai_chat_engine import generate_chat_response
from database.config import get_db
from database.crud import get_dashboard_stats as get_db_stats, get_recent_threats, get_threat_activity, get_attack_tactic_coverage
from api.dependencies import get_current_user, get_workspace, WorkspaceState
from database.models import User
import json
import os

# Cache for framework totals to avoid disk I/O on every request
_FRAMEWORK_TOTALS_CACHE = {}

def get_framework_data_totals():
    global _FRAMEWORK_TOTALS_CACHE
    if _FRAMEWORK_TOTALS_CACHE:
        return _FRAMEWORK_TOTALS_CACHE

    totals = {
        "attack": {"total": 0, "by_tactic": {}},
        "defend": 0,
        "nist": 0,
        "owasp": 0
    }

    try:
        data_dir = "data"
        # 1. ATT&CK
        attack_path = os.path.join(data_dir, "mitre_attack.json")
        if os.path.exists(attack_path):
            with open(attack_path, "r") as f:
                attack_data = json.load(f)
                totals["attack"]["total"] = len(attack_data)
                for item in attack_data:
                    tactic = item.get("tactic", "Unknown")
                    totals["attack"]["by_tactic"][tactic] = totals["attack"]["by_tactic"].get(tactic, 0) + 1

        # 2. DEFEND
        defend_path = os.path.join(data_dir, "mitre_defend.json")
        if os.path.exists(defend_path):
            with open(defend_path, "r") as f:
                totals["defend"] = len(json.load(f))

        # 3. NIST
        nist_path = os.path.join(data_dir, "nist_controls.json")
        if os.path.exists(nist_path):
            with open(nist_path, "r") as f:
                totals["nist"] = len(json.load(f))

        # 4. OWASP
        owasp_path = os.path.join(data_dir, "owasp_data.json")
        if os.path.exists(owasp_path):
            with open(owasp_path, "r") as f:
                owasp_data = json.load(f)
                totals["owasp"] = len(owasp_data.get("top10", [])) + len(owasp_data.get("asvs", []))

        _FRAMEWORK_TOTALS_CACHE = totals
    except Exception as e:
        print(f"Error loading framework totals: {e}")
    
    return totals

router = APIRouter(prefix="/api", tags=["intelligence"])


@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(request: ChatRequest, current_user: User = Depends(get_current_user)):
    """General cyber threat intelligence chat."""
    try:
        result = generate_chat_response(
            request.message,
            request.history,
            request.threat_context
        )
        return ChatResponse(
            response=result['response'],
            suggestions=result.get('suggestions', [])
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    workspace: WorkspaceState = Depends(get_workspace),
):
    """Get dashboard statistics, scoped to the user's group if applicable."""
    stats = await get_db_stats(db, current_user.id, group_id=workspace.group_id, view_mode=workspace.view_mode)
    framework_totals = get_framework_data_totals()
    stats["total_techniques"] = framework_totals["attack"]["total"]
    stats["last_updated"] = datetime.utcnow().isoformat()
    return stats


@router.get("/dashboard/activity")
async def get_activity(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    workspace: WorkspaceState = Depends(get_workspace),
):
    """Get threat counts grouped by day/severity, scoped to the user's group."""
    return await get_threat_activity(db, current_user.id, group_id=workspace.group_id, view_mode=workspace.view_mode)


@router.get("/intelligence/feed")
async def get_threat_feed(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    workspace: WorkspaceState = Depends(get_workspace),
):
    """Get live threat intelligence feed blending OSINT sources + analyzed threats."""
    from core.osint_client import fetch_all_osint, RUNTIME_CONFIG
    from database.models import OSINTFeedItem
    from sqlalchemy.future import select

    # Run OSINT fetch + DB query concurrently
    osint_task = asyncio.create_task(fetch_all_osint())
    db_threats = await get_recent_threats(db, limit=20, user_id=current_user.id, group_id=workspace.group_id, view_mode=workspace.view_mode)
    osint_result = await osint_task

    feed_items = []

    # 1. User's own analyzed threats from DB (shown first, most relevant)
    for t in db_threats:
        primary_tech_id = ""
        primary_tactic  = ""
        if t.techniques:
            primary_tech_id = t.techniques[0].technique_id
            primary_tactic  = t.techniques[0].tactic
        elif isinstance(t.raw_indicators, dict) and t.raw_indicators.get("technique_ids"):
            primary_tech_id = t.raw_indicators["technique_ids"][0]

        frameworks = ["ATT&CK"]
        if t.framework_coverage_defend > 0: frameworks.append("D3FEND")
        if t.framework_coverage_nist   > 0: frameworks.append("NIST")
        if t.framework_coverage_owasp  > 0: frameworks.append("OWASP")

        iocs = [e.value for e in t.entities[:3]]

        feed_items.append({
            "id":          t.id,
            "title":       t.title,
            "severity":    t.severity,
            "technique":   primary_tech_id,
            "tactic":      primary_tactic or "Unknown",
            "timestamp":   t.timestamp,
            "source":      f"autoMITRE ({t.input_type})",
            "source_key":  "db",
            "iocs":        iocs,
            "frameworks":  frameworks,
            "description": t.description[:200] if t.description else "",
            "external_url": "",
            "tags":        [],
        })

    # 2. Add local historical OSINT if enabled
    store_locally = str(RUNTIME_CONFIG.get("osint_store_locally", "false")).lower() == "true"
    db_osint = []
    if store_locally:
        try:
            stmt = select(OSINTFeedItem).order_by(OSINTFeedItem.timestamp.desc()).limit(1500)
            result = await db.execute(stmt)
            db_osint = result.scalars().all()
        except Exception as e:
            pass
            
    # Serialize historical OSINT
    historic_entries = []
    for d in db_osint:
        historic_entries.append({
            "id": d.id,
            "title": d.title,
            "severity": d.severity,
            "technique": d.technique,
            "tactic": d.tactic,
            "timestamp": d.timestamp,
            "source": f"{d.source} (Local DB)",
            "source_key": d.source_key,
            "iocs": d.iocs or [],
            "frameworks": d.frameworks or [],
            "description": d.description or "",
            "external_url": d.external_url or "",
            "tags": d.tags or [],
            "is_historic": True
        })

    # 3. Live OSINT items from external sources + Historic
    all_osint = osint_result.get("items", []) + historic_entries
    
    # Deduplicate by ID
    seen_ids = set()
    deduped_osint = []
    for item in all_osint:
        if item["id"] not in seen_ids:
            seen_ids.add(item["id"])
            deduped_osint.append(item)
            
    feed_items.extend(deduped_osint)

    # Sort everything by timestamp descending
    feed_items.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

    return {
        "threats":      feed_items,
        "total":        len(feed_items),
        "sources":      osint_result.get("sources", {}),
        "last_updated": datetime.utcnow().isoformat(),
    }


@router.get("/intelligence/osint-history")
async def get_osint_history(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get strictly historical OSINT feed items from the local database."""
    from database.models import OSINTFeedItem
    from sqlalchemy.future import select
    
    try:
        stmt = select(OSINTFeedItem).order_by(OSINTFeedItem.timestamp.desc()).limit(1500)
        result = await db.execute(stmt)
        db_osint = result.scalars().all()
    except Exception as e:
        db_osint = []
        
    historic_entries = []
    for d in db_osint:
        historic_entries.append({
            "id": d.id,
            "title": d.title,
            "severity": d.severity,
            "technique": d.technique,
            "tactic": d.tactic,
            "timestamp": d.timestamp,
            "source": f"{d.source} (Local DB)",
            "source_key": d.source_key,
            "iocs": d.iocs or [],
            "frameworks": d.frameworks or [],
            "description": d.description or "",
            "external_url": d.external_url or "",
            "tags": d.tags or [],
            "is_historic": True
        })
        
    return {
        "items": historic_entries,
        "total": len(historic_entries)
    }


@router.get("/intelligence/feed/sources")
async def get_feed_sources(current_user: User = Depends(get_current_user)):
    """Return configuration status of all OSINT sources (no live fetch)."""
    from core.osint_client import get_source_status
    return {"sources": get_source_status()}



@router.get("/framework/coverage")
async def get_framework_coverage(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get framework coverage statistics."""
    tactic_stats = await get_attack_tactic_coverage(db, current_user.id)
    framework_totals = get_framework_data_totals()
    
    # Process ATT&CK By Tactic
    attack_totals = framework_totals["attack"]["by_tactic"]
    dynamic_by_tactic = {}
    normalized_tactic_stats = {k.lower(): v for k, v in tactic_stats.items()}
    
    for name, total in attack_totals.items():
        covered = normalized_tactic_stats.get(name.lower(), 0)
        dynamic_by_tactic[name] = {"total": total, "covered": covered}

    # Get total unique techniques covered for the top level percentage
    stats = await get_db_stats(db, current_user.id)
    unique_techs = stats.get("techniques_covered", 0)
    total_techs_in_framework = framework_totals["attack"]["total"]

    return {
        "attack": {
            "total_techniques": total_techs_in_framework,
            "covered": unique_techs,
            "percentage": round((unique_techs / total_techs_in_framework) * 100, 1) if total_techs_in_framework > 0 else 0,
            "by_tactic": dynamic_by_tactic
        },
        "defend": {
            "total_countermeasures": framework_totals["defend"],
            "covered": stats.get("defend_covered", 15), # Placeholder for real count if not in stats
            "percentage": round((15 / framework_totals["defend"]) * 100, 1) if framework_totals["defend"] > 0 else 0
        },
        "nist": {
            "total_controls": framework_totals["nist"],
            "covered": stats.get("nist_covered", 16),
            "percentage": round((16 / framework_totals["nist"]) * 100, 1) if framework_totals["nist"] > 0 else 0
        },
        "owasp": {
            "total_items": framework_totals["owasp"],
            "covered": stats.get("owasp_covered", 10),
            "percentage": round((10 / framework_totals["owasp"]) * 100, 1) if framework_totals["owasp"] > 0 else 0
        }
    }


@router.delete("/intelligence/osint/{item_id}")
async def delete_osint_item_endpoint(item_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Delete a historical OSINT item from the local database."""
    from database.crud import delete_osint_item
    success = await delete_osint_item(db, item_id)
    if not success:
        raise HTTPException(status_code=404, detail="OSINT item not found or failed to delete.")
        
    return {"success": True, "message": "OSINT item deleted successfully."}
