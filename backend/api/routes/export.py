"""
Export API Routes
Handles threat intelligence export to STIX, JSON, CSV, and SIEM platforms.
All endpoints return StreamingResponse with proper Content-Disposition headers
so the browser triggers a real file download.
"""
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from fastapi.responses import StreamingResponse, Response
import json
import io
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from jose import jwt, JWTError

from models.schemas import ExportRequest
from core.siem_exporter import export_to_stix, export_to_json, export_to_csv, format_for_splunk
from core.pdf_generator import generate_pdf_report
from api.dependencies import get_current_user
from database.models import User
from database.config import get_db
from database.crud import get_threat_by_id, get_recent_threats
from core.security import SECRET_KEY, ALGORITHM
from core.audit import log_event

router = APIRouter(prefix="/api/export", tags=["export"])


@router.post("/stix")
async def export_stix(request: ExportRequest, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Export threat intelligence as STIX 2.1 bundle."""
    try:
        real_threats = await _get_real_threats(request.threat_ids, db)
        bundle = export_to_stix(real_threats)
        content = json.dumps(bundle, indent=2).encode("utf-8")
        background_tasks.add_task(log_event,
            category="EXPORT", action="export_stix",
            user_id=current_user.id, username=current_user.username,
            details={"threat_count": len(real_threats), "format": "stix2.1"}
        )
        return StreamingResponse(io.BytesIO(content), media_type="application/json",
            headers={"Content-Disposition": "inline; filename=autoMITRE_stix2.1.json"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/json")
async def export_json(request: ExportRequest, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Export threat intelligence as structured JSON."""
    try:
        real_threats = await _get_real_threats(request.threat_ids, db)
        result = export_to_json(real_threats)
        content = json.dumps(result, indent=2).encode("utf-8")
        background_tasks.add_task(log_event,
            category="EXPORT", action="export_json",
            user_id=current_user.id, username=current_user.username,
            details={"threat_count": len(real_threats), "format": "json"}
        )
        return StreamingResponse(io.BytesIO(content), media_type="application/json",
            headers={"Content-Disposition": "inline; filename=autoMITRE_export.json"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/csv")
async def export_csv(request: ExportRequest, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Export threat intelligence as CSV."""
    try:
        real_threats = await _get_real_threats(request.threat_ids, db)
        csv_content = export_to_csv(real_threats)
        background_tasks.add_task(log_event,
            category="EXPORT", action="export_csv",
            user_id=current_user.id, username=current_user.username,
            details={"threat_count": len(real_threats), "format": "csv"}
        )
        return StreamingResponse(io.StringIO(csv_content), media_type="text/csv",
            headers={"Content-Disposition": "inline; filename=autoMITRE_export.csv"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/splunk")
async def export_splunk(request: ExportRequest, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Format threats for Splunk HEC ingestion."""
    try:
        real_threats = await _get_real_threats(request.threat_ids, db)
        result = format_for_splunk(real_threats)
        content = json.dumps({"events": result}, indent=2).encode("utf-8")
        background_tasks.add_task(log_event,
            category="EXPORT", action="export_splunk",
            user_id=current_user.id, username=current_user.username,
            details={"threat_count": len(real_threats), "format": "splunk_hec"}
        )
        return StreamingResponse(io.BytesIO(content), media_type="application/json",
            headers={"Content-Disposition": "inline; filename=autoMITRE_splunk_hec.json"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pdf")
async def export_pdf(request: ExportRequest, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Export threat intelligence as a formatted PDF report."""
    try:
        real_threats = await _get_real_threats(request.threat_ids, db)
        report_type = request.format if request.format in ("executive", "technical", "managerial") else "executive"
        pdf_bytes = generate_pdf_report(real_threats, report_type)
        background_tasks.add_task(log_event,
            category="EXPORT", action="export_pdf",
            user_id=current_user.id, username=current_user.username,
            details={"threat_count": len(real_threats), "format": f"pdf_{report_type}"}
        )
        return StreamingResponse(pdf_bytes, media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=autoMITRE_{report_type}_report.pdf"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/download/{format}")
@router.get("/download/{format}/{filename}")
async def export_download_get(format: str, token: str = Query(...), db: AsyncSession = Depends(get_db), filename: str = None):
    """
    Direct GET download endpoint for browser compatibility.
    Bypasses CORS/Blob restrictions by allowing direct navigation (window.location.href).
    Exports ALL history for the user identified by the query token.
    """
    try:
        # 1. Authenticate user from query token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        result = await db.execute(select(User).filter(User.username == username))
        user = result.scalars().first()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="Invalid or inactive user")

        # 2. Fetch all user history
        db_threats = await get_recent_threats(db, limit=1000, user_id=user.id)
        if not db_threats:
            raise HTTPException(status_code=404, detail="No threats found to export")

        # 3. Map to export format
        real_threats = []
        for record in db_threats:
            real_threats.append({
                "id": record.id,
                "title": record.title,
                "description": record.description,
                "timestamp": str(record.timestamp),
                "confidence": 100,
                "risk_score": {"score": record.risk_score, "severity": record.severity},
                "attack_techniques": [
                    {"id": t.technique_id, "name": t.name, "tactic": t.tactic, "description": t.description}
                    for t in record.techniques
                ],
                "mitigations": [
                    {
                        "title": m.title, 
                        "description": m.description,
                        "priority": getattr(m, 'priority', 'Medium'),
                        "iac_snippet": getattr(m, 'iac_snippet', ''),
                        "iac_type": getattr(m, 'iac_type', '')
                    }
                    for m in record.mitigations
                ],
                "defend_countermeasures": record.defend_json if getattr(record, 'defend_json', None) else [],
                "nist_controls": record.nist_json if getattr(record, 'nist_json', None) else [],
                "owasp_items": record.owasp_json if getattr(record, 'owasp_json', None) else []
            })


        # 4. Generate the right format and log the export
        audit_detail = {"format": format, "threat_count": len(real_threats), "user": username}
        if format == "stix":
            bundle = export_to_stix(real_threats)
            content = json.dumps(bundle, indent=2).encode("utf-8")
            await log_event(category="EXPORT", action="export_stix_download",
                user_id=user.id, username=user.username, details=audit_detail)
            return Response(content=content, media_type="application/json",
                headers={"Content-Disposition": 'attachment; filename="autoMITRE_stix2.1.json"'})
        elif format == "json":
            exp_result = export_to_json(real_threats)
            content = json.dumps(exp_result, indent=2).encode("utf-8")
            await log_event(category="EXPORT", action="export_json_download",
                user_id=user.id, username=user.username, details=audit_detail)
            return Response(content=content, media_type="application/json",
                headers={"Content-Disposition": 'attachment; filename="autoMITRE_export.json"'})
        elif format == "csv":
            csv_content = export_to_csv(real_threats)
            content = csv_content.encode("utf-8")
            await log_event(category="EXPORT", action="export_csv_download",
                user_id=user.id, username=user.username, details=audit_detail)
            return Response(content=content, media_type="text/csv",
                headers={"Content-Disposition": 'attachment; filename="autoMITRE_export.csv"'})
        elif format == "splunk":
            exp_result = format_for_splunk(real_threats)
            content = json.dumps({"events": exp_result}, indent=2).encode("utf-8")
            await log_event(category="EXPORT", action="export_splunk_download",
                user_id=user.id, username=user.username, details=audit_detail)
            return Response(content=content, media_type="application/json",
                headers={"Content-Disposition": 'attachment; filename="autoMITRE_splunk_hec.json"'})
        elif format in ("executive", "technical", "managerial"):
            pdf_bytes = generate_pdf_report(real_threats, format)
            content = pdf_bytes.getvalue()
            await log_event(category="EXPORT", action=f"export_pdf_{format}_download",
                user_id=user.id, username=user.username, details=audit_detail)
            return Response(content=content, media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="autoMITRE_{format}_report.pdf"'})
        else:
            raise HTTPException(status_code=400, detail="Unknown format")

    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token signature")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def _get_real_threats(threat_ids: list, db: AsyncSession) -> list:
    """Fetches real threat records from the database and maps them to export format."""
    threats = []
    for tid in threat_ids:
        record = await get_threat_by_id(db, tid)
        if record:
            threats.append({
                "id": record.id,
                "title": record.title,
                "description": record.description,
                "timestamp": str(record.timestamp),
                "confidence": 100,
                "risk_score": {"score": record.risk_score, "severity": record.severity},
                "attack_techniques": [
                    {"id": t.technique_id, "name": t.name, "tactic": t.tactic, "description": t.description}
                    for t in record.techniques
                ],
                "mitigations": [
                    {
                        "title": m.title, 
                        "description": m.description,
                        "priority": getattr(m, 'priority', 'Medium'),
                        "iac_snippet": getattr(m, 'iac_snippet', ''),
                        "iac_type": getattr(m, 'iac_type', '')
                    }
                    for m in record.mitigations
                ],
                "defend_countermeasures": record.defend_json if getattr(record, 'defend_json', None) else [],
                "nist_controls": record.nist_json if getattr(record, 'nist_json', None) else [],
                "owasp_items": record.owasp_json if getattr(record, 'owasp_json', None) else []
            })
    return threats
