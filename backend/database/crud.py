from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, desc, or_, and_
from typing import List, Dict, Any

from database import models
from models.schemas import ThreatResult, SeverityLevel


async def create_threat_record(db: AsyncSession, threat: ThreatResult, user_id: str = None, group_id: str = None) -> models.ThreatRecord:
    """Save a new threat analysis result to the database."""
    
    # Create main record
    db_threat = models.ThreatRecord(
        id=threat.id,
        user_id=user_id,
        group_id=group_id,
        title=threat.title,
        description=threat.description,
        input_type=threat.input_type,
        risk_score=threat.risk_score.score,
        severity=threat.risk_score.severity.value,
        likelihood=threat.risk_score.likelihood,
        impact_score=threat.risk_score.impact,
        business_impact=threat.risk_score.business_impact,
        raw_indicators=threat.raw_indicators,
        framework_coverage_attack=len(threat.attack_techniques),
        framework_coverage_defend=len(threat.defend_countermeasures),
        framework_coverage_nist=len(threat.nist_controls),
        framework_coverage_owasp=len(threat.owasp_items),
        defend_json=[m.model_dump() for m in threat.defend_countermeasures],
        nist_json=[m.model_dump() for m in threat.nist_controls],
        owasp_json=[m.model_dump() for m in threat.owasp_items],
        timestamp=threat.timestamp
    )
    db.add(db_threat)
    
    # Add entities
    for entity in threat.entities:
        db_entity = models.ThreatEntity(
            threat_id=threat.id,
            type=entity.type,
            value=entity.value,
            context=entity.context
        )
        db.add(db_entity)
        
    # Add techniques
    for tech in threat.attack_techniques:
        db_tech = models.ThreatTechnique(
            threat_id=threat.id,
            technique_id=tech.id,
            name=tech.name,
            tactic=tech.tactic,
            tactic_id=tech.tactic_id,
            description=tech.description,
            confidence=tech.confidence,
            verified=tech.verified,
            evidence=tech.evidence
        )
        db.add(db_tech)
        
    # Add mitigations
    for mit in threat.mitigations:
        db_mit = models.ThreatMitigation(
            threat_id=threat.id,
            title=mit.title,
            description=mit.description,
            priority=mit.priority,
            effort=mit.effort,
            iac_snippet=mit.iac_snippet,
            iac_type=mit.iac_type
        )
        db.add(db_mit)
        
    # Add predicted steps
    for step in threat.predicted_steps:
        db_step = models.ThreatPredictedStep(
            threat_id=threat.id,
            step_id=step.id,
            title=step.title,
            description=step.description,
            confidence=step.confidence
        )
        db.add(db_step)
        
    await db.commit()
    await db.refresh(db_threat)
    return db_threat


from sqlalchemy.orm import selectinload

async def get_recent_threats(db: AsyncSession, limit: int = 20, user_id: str = None, group_id: str = None, view_mode: str = "both") -> List[models.ThreatRecord]:
    """
    Get the most recent threat records.
    """
    query = (
        select(models.ThreatRecord)
        .options(selectinload(models.ThreatRecord.techniques))
        .options(selectinload(models.ThreatRecord.entities))
        .options(selectinload(models.ThreatRecord.mitigations))
        .options(selectinload(models.ThreatRecord.predicted_steps))
    )
    if view_mode == "team" and group_id:
        query = query.where(models.ThreatRecord.group_id == group_id)
    elif view_mode == "both" and group_id and user_id:
        query = query.where(
            or_(
                models.ThreatRecord.group_id == group_id,
                and_(models.ThreatRecord.user_id == user_id, models.ThreatRecord.group_id == None),
            )
        )
    elif user_id:
        query = query.where(and_(models.ThreatRecord.user_id == user_id, models.ThreatRecord.group_id == None))

    query = query.order_by(desc(models.ThreatRecord.timestamp)).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def get_dashboard_stats(db: AsyncSession, user_id: str = None, group_id: str = None, view_mode: str = "both") -> Dict[str, Any]:
    """
    Calculate dashboard statistics.
    """
    if view_mode == "team" and group_id:
        base_where = [models.ThreatRecord.group_id == group_id]
    elif view_mode == "both" and group_id and user_id:
        base_where = [or_(
            models.ThreatRecord.group_id == group_id,
            and_(models.ThreatRecord.user_id == user_id, models.ThreatRecord.group_id == None),
        )]
    elif user_id:
        base_where = [and_(models.ThreatRecord.user_id == user_id, models.ThreatRecord.group_id == None)]
    else:
        base_where = []
    
    # Total threats
    query = select(func.count(models.ThreatRecord.id))
    if base_where: query = query.where(*base_where)
    result = await db.execute(query)
    total_threats = result.scalar() or 0
    
    if total_threats == 0:
        return {
            "total_threats": 0,
            "critical_threats": 0,
            "high_threats": 0,
            "medium_threats": 0,
            "low_threats": 0,
            "techniques_covered": 0,
            "frameworks_mapped": 4,
            "active_framework_names": ["ATT&CK", "D3FEND", "NIST", "OWASP"],
            "risk_score_avg": 0.0,
        }
        
    # Severity counts
    async def get_count(severity_level):
        q = select(func.count(models.ThreatRecord.id)).where(models.ThreatRecord.severity == severity_level)
        if base_where: q = q.where(*base_where)
        res = await db.execute(q)
        return res.scalar() or 0

    critical = await get_count(SeverityLevel.CRITICAL.value)
    high = await get_count(SeverityLevel.HIGH.value)
    medium = await get_count(SeverityLevel.MEDIUM.value)
    low = await get_count(SeverityLevel.LOW.value)
    
    # Average Risk Score
    q_avg = select(func.avg(models.ThreatRecord.risk_score))
    if base_where: q_avg = q_avg.where(*base_where)
    avg_score = (await db.execute(q_avg)).scalar() or 0.0
    
    # Unique Techniques Covered
    q_tech = select(func.count(func.distinct(models.ThreatTechnique.technique_id))).join(models.ThreatRecord)
    if base_where: q_tech = q_tech.where(*base_where)
    unique_techs = (await db.execute(q_tech)).scalar() or 0
    
    from core.osint_client import RUNTIME_CONFIG
    
    frameworks = [
        ("framework_attack", "ATT&CK"),
        ("framework_defend", "D3FEND"),
        ("framework_nist", "NIST"),
        ("framework_owasp", "OWASP")
    ]
    active_names = [name for key, name in frameworks if str(RUNTIME_CONFIG.get(key, "True")).lower() == "true"]

    return {
        "total_threats": total_threats,
        "critical_threats": critical,
        "high_threats": high,
        "medium_threats": medium,
        "low_threats": low,
        "techniques_covered": unique_techs,
        "frameworks_mapped": len(active_names),
        "active_framework_names": active_names,
        "risk_score_avg": round(avg_score, 1)
    }


async def get_threat_by_id(db: AsyncSession, threat_id: str) -> models.ThreatRecord:
    """Get a specific threat by ID."""
    query = (
        select(models.ThreatRecord)
        .where(models.ThreatRecord.id == threat_id)
        .options(selectinload(models.ThreatRecord.techniques))
        .options(selectinload(models.ThreatRecord.entities))
        .options(selectinload(models.ThreatRecord.mitigations))
        .options(selectinload(models.ThreatRecord.predicted_steps))
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_threat_activity(db: AsyncSession, user_id: str = None, group_id: str = None, view_mode: str = "both") -> Dict[str, Any]:
    """
    Fetch threat counts grouped by day/severity for the last 7 days.
    """
    from datetime import datetime, timedelta
    
    now = datetime.utcnow()
    labels = []
    for i in range(6, -1, -1):
        day = now - timedelta(days=i)
        labels.append(day.strftime("%a"))
    
    datasets = {"Critical": [0]*7, "High": [0]*7, "Medium": [0]*7, "Low": [0]*7}
    start_date = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
    start_iso = start_date.isoformat()
    
    query = select(models.ThreatRecord.timestamp, models.ThreatRecord.severity)
    
    if view_mode == "team" and group_id:
        query = query.where(models.ThreatRecord.group_id == group_id)
    elif view_mode == "both" and group_id and user_id:
        query = query.where(or_(
            models.ThreatRecord.group_id == group_id,
            and_(models.ThreatRecord.user_id == user_id, models.ThreatRecord.group_id == None),
        ))
    elif user_id:
        query = query.where(and_(models.ThreatRecord.user_id == user_id, models.ThreatRecord.group_id == None))
    query = query.where(models.ThreatRecord.timestamp >= start_iso)
    
    result = await db.execute(query)
    for ts_str, severity in result.all():
        try:
            ts = datetime.fromisoformat(ts_str)
            days_diff = (ts.date() - start_date.date()).days
            if 0 <= days_diff < 7:
                sev_str = str(severity)
                if sev_str in datasets:
                    datasets[sev_str][days_diff] += 1
        except Exception:
            continue
            
    return {
        "labels": labels,
        "datasets": [{"label": label, "data": data} for label, data in datasets.items()]
    }


async def get_attack_tactic_coverage(db: AsyncSession, user_id: str = None, group_id: str = None, view_mode: str = "both") -> Dict[str, int]:
    """
    Calculate unique techniques covered per tactic.
    """
    query = (
        select(models.ThreatTechnique.tactic, func.count(func.distinct(models.ThreatTechnique.technique_id)))
        .join(models.ThreatRecord)
    )
    if view_mode == "team" and group_id:
        query = query.where(models.ThreatRecord.group_id == group_id)
    elif view_mode == "both" and group_id and user_id:
        query = query.where(or_(
            models.ThreatRecord.group_id == group_id,
            and_(models.ThreatRecord.user_id == user_id, models.ThreatRecord.group_id == None),
        ))
    elif user_id:
        query = query.where(and_(models.ThreatRecord.user_id == user_id, models.ThreatRecord.group_id == None))
    
    query = query.group_by(models.ThreatTechnique.tactic)
    result = await db.execute(query)
    
    coverage = {}
    for tactic, count in result.all():
        coverage[tactic] = count
    return coverage


async def delete_threat_record(db: AsyncSession, threat_id: str) -> bool:
    """Delete a threat record by ID. Cascades to children."""
    query = select(models.ThreatRecord).where(models.ThreatRecord.id == threat_id)
    result = await db.execute(query)
    record = result.scalar_one_or_none()
    
    if record:
        await db.delete(record)
        await db.commit()
        return True
    return False


async def delete_osint_item(db: AsyncSession, item_id: str) -> bool:
    """Delete an OSINT feed item from the local database."""
    query = select(models.OSINTFeedItem).where(models.OSINTFeedItem.id == item_id)
    result = await db.execute(query)
    item = result.scalar_one_or_none()
    
    if item:
        await db.delete(item)
        await db.commit()
        return True
    return False
