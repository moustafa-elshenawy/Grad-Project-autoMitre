"""
OSINT Aggregator — Multi-source real-time threat intelligence feeds.

Sources supported:
  1. MISP (Malware Information Sharing Platform) — configurable via env vars or runtime config
  2. Abuse.ch URLhaus — recent malicious URLs & IPs (free, no key)
  3. Abuse.ch MalwareBazaar — recent malware samples (free, no key)
  4. AlienVault OTX (Open Threat Exchange) — OSINT pulses (free key via OTX_API_KEY)

All sources are fetched concurrently and normalised into a unified ThreatFeedItem format.
Results are cached in-memory for OSINT_CACHE_TTL seconds (default: 300 = 5 min) to avoid
hammering external APIs on every page refresh.
"""

import asyncio
import os
import time
import uuid
import logging
import csv
import io
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

import httpx
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from database.config import SessionLocal
from database.models import OSINTFeedItem
from sqlalchemy.future import select

load_dotenv(override=True)

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────

MISP_URL        = os.getenv("MISP_URL", "").rstrip("/")
MISP_API_KEY    = os.getenv("MISP_API_KEY", "")
OTX_API_KEY     = os.getenv("OTX_API_KEY", "")
CACHE_TTL       = int(os.getenv("OSINT_CACHE_TTL", "300"))   # seconds

def _get_otx_key() -> str:
    """Dynamically resolve OTX API key — checks runtime config first, then reloads .env."""
    # 1. Runtime config (set via settings UI)
    if RUNTIME_CONFIG.get("otx_api_key"):
        return RUNTIME_CONFIG["otx_api_key"]
    # 2. Already in environment
    env_key = os.getenv("OTX_API_KEY", "")
    if env_key:
        return env_key
    # 3. Hot-reload from .env file (picks up changes without restart)
    try:
        import pathlib
        env_path = pathlib.Path(__file__).resolve().parent.parent / ".env"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("OTX_API_KEY="):
                    val = line.split("=", 1)[1].strip()
                    if val:
                        os.environ["OTX_API_KEY"] = val
                        return val
    except Exception:
        pass
    return ""


URLHAUS_API     = "https://urlhaus.abuse.ch/downloads/json_online/"
BAZAAR_CSV      = "https://bazaar.abuse.ch/export/csv/recent/"
OTX_BASE        = "https://otx.alienvault.com/api/v1"

# A dedicated settings file for runtime-configured variables (set via UI)
RUNTIME_CONFIG: Dict[str, Any] = {
    "osint_limit": os.getenv("OSINT_LIMIT", "50"),
    "osint_min_severity": os.getenv("OSINT_MIN_SEVERITY", "Low"),
    "osint_store_locally": os.getenv("OSINT_STORE_LOCALLY", "False"),
    "framework_attack": os.getenv("FRAMEWORK_ATTACK", "True"),
    "framework_defend": os.getenv("FRAMEWORK_DEFEND", "True"),
    "framework_nist": os.getenv("FRAMEWORK_NIST", "True"),
    "framework_owasp": os.getenv("FRAMEWORK_OWASP", "True"),
}

# ── Cache ─────────────────────────────────────────────────────────────────────

_cache: Dict[str, Any] = {}   # { key: (timestamp, data) }


def _cached(key: str):
    entry = _cache.get(key)
    if entry and (time.time() - entry[0]) < CACHE_TTL:
        return entry[1]
    return None


def _store(key: str, data: Any):
    _cache[key] = (time.time(), data)


# ── Unified item model ────────────────────────────────────────────────────────

@dataclass
class ThreatFeedItem:
    id: str
    title: str
    severity: str          # Critical | High | Medium | Low
    technique: str
    tactic: str
    timestamp: str
    source: str            # human label e.g. "MISP", "URLhaus", "OTX"
    source_key: str        # machine label: "misp" | "urlhaus" | "bazaar" | "otx" | "db"
    iocs: List[str] = field(default_factory=list)
    frameworks: List[str] = field(default_factory=list)
    description: str = ""
    external_url: str = ""
    tags: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "severity": self.severity,
            "technique": self.technique,
            "tactic": self.tactic,
            "timestamp": self.timestamp,
            "source": self.source,
            "source_key": self.source_key,
            "iocs": self.iocs,
            "frameworks": self.frameworks,
            "description": self.description,
            "external_url": self.external_url,
            "tags": self.tags,
        }


# ── Severity helpers ──────────────────────────────────────────────────────────

_THREAT_LEVEL_MAP = {       # MISP threat_level_id
    "1": "High",
    "2": "Medium",
    "3": "Low",
    "4": "Low",
}

_SCORE_TO_SEV = [
    (80, "Critical"),
    (60, "High"),
    (40, "Medium"),
    (0,  "Low"),
]


def _score_severity(score: float) -> str:
    for threshold, label in _SCORE_TO_SEV:
        if score >= threshold:
            return label
    return "Low"


def _sev_to_int(sev: str) -> int:
    mapping = {"Low": 0, "Medium": 40, "High": 60, "Critical": 80}
    return mapping.get(sev, 0)


def _relative_time(iso: str) -> str:
    """Return human-friendly relative time string from an ISO datetime string."""
    try:
        import datetime
        dt = datetime.datetime.fromisoformat(iso.replace("Z", "+00:00"))
        now = datetime.datetime.now(tz=datetime.timezone.utc)
        diff = int((now - dt).total_seconds())
        if diff < 60:
            return "just now"
        if diff < 3600:
            return f"{diff // 60}m ago"
        if diff < 86400:
            return f"{diff // 3600}h ago"
        return f"{diff // 86400}d ago"
    except Exception:
        return iso[:10] if len(iso) >= 10 else iso


# ── MISP ──────────────────────────────────────────────────────────────────────

def _misp_url() -> str:
    return RUNTIME_CONFIG.get("misp_url") or MISP_URL

def _misp_key() -> str:
    return RUNTIME_CONFIG.get("misp_api_key") or MISP_API_KEY


async def fetch_misp(client: httpx.AsyncClient) -> List[ThreatFeedItem]:
    url  = _misp_url()
    key  = _misp_key()
    limit = int(RUNTIME_CONFIG.get("osint_limit", 50))
    min_sev = RUNTIME_CONFIG.get("osint_min_severity", "Low")
    
    if not url or not key:
        return []

    cache_key = f"misp_{url}_{limit}"
    cached = _cached(cache_key)
    if cached is not None:
        return cached

    try:
        resp = await client.post(
            f"{url}/events/restSearch",
            headers={
                "Authorization": key,
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            json={"limit": limit, "returnFormat": "json", "published": True},
            timeout=15.0,
        )
        resp.raise_for_status()
        data = resp.json()
        events = data.get("response", []) if isinstance(data, dict) else data
    except Exception as exc:
        logger.warning("MISP fetch failed: %s", exc)
        return []

    items: List[ThreatFeedItem] = []
    for ev in (events or []):
        ev_data = ev.get("Event", ev)
        tid = ev_data.get("id", str(uuid.uuid4()))
        info = ev_data.get("info", "Unknown MISP event")
        ts_raw = ev_data.get("timestamp", "")
        sev = _THREAT_LEVEL_MAP.get(str(ev_data.get("threat_level_id", "3")), "Medium")
        attrs = ev_data.get("Attribute", [])
        iocs = [a.get("value", "") for a in attrs if a.get("value")][:5]
        tags_raw = [t.get("name", "") for t in ev_data.get("Tag", [])]

        # Try to find a MITRE technique tag
        technique = ""
        tactic = ""
        for tag in tags_raw:
            if "mitre-attack-pattern" in tag or "T1" in tag:
                parts = tag.split("=")
                if len(parts) > 1:
                    technique = parts[-1].strip('"').split(" ")[0]
                    break

        try:
            import datetime
            dt = datetime.datetime.utcfromtimestamp(int(ts_raw))
            ts = dt.isoformat()
        except Exception:
            ts = ts_raw or "unknown"

        item = ThreatFeedItem(
            id=f"misp-{tid}",
            title=info,
            severity=sev,
            source="MISP",
            source_key="misp",
            timestamp=ts,
            iocs=iocs,
            technique=technique,
            tactic=tactic,
            tags=tags_raw[:5],
            external_url=f"{url}/events/view/{tid}",
        )
        
        # Apply severity filter
        if _sev_to_int(sev) >= _sev_to_int(min_sev):
            items.append(item)
            if len(items) >= limit:
                break

    _store(cache_key, items)
    return items


# ── Abuse.ch URLhaus ──────────────────────────────────────────────────────────

async def fetch_urlhaus(client: httpx.AsyncClient) -> List[ThreatFeedItem]:
    cached = _cached("urlhaus")
    if cached is not None:
        return cached

    limit = int(RUNTIME_CONFIG.get("osint_limit", 50))
    min_sev = RUNTIME_CONFIG.get("osint_min_severity", "Low")
    
    cached = _cached(f"urlhaus_{limit}")
    if cached is not None:
        return cached

    try:
        # Use a proper User-Agent to avoid blocks
        headers = {'User-Agent': 'autoMITRE Threat Intel Aggregator/1.2'}
        resp = await client.get(URLHAUS_API, headers=headers, timeout=15.0)
        resp.raise_for_status()
        data = resp.json()
        
        # URLhaus bulk JSON is a dict where keys are IDs and values are LISTS of records.
        if isinstance(data, dict):
            entries = list(data.values())
        elif isinstance(data, list):
            entries = data
        else:
            entries = []

        items: List[ThreatFeedItem] = []
        seen_hosts: set = set()
        
        limit = int(RUNTIME_CONFIG.get("osint_limit", 50))
        min_sev = RUNTIME_CONFIG.get("osint_min_severity", "Low")

        for entry in entries:
            # entry is typically a list (bulk JSON format) or a dict (standard API)
            records = entry if isinstance(entry, list) else [entry]

            for r in records:
                if not isinstance(r, dict): continue
                url_str   = r.get("url", "")
                host      = url_str.split("/")[2] if "/" in url_str and len(url_str.split("/")) > 2 else ""
                status    = r.get("url_status", "")
                tags      = r.get("tags") or []
                date_added = r.get("dateadded", "") # Format: "2024-03-21 12:34:56 UTC"
                threat    = r.get("threat", "malware_download")
                import hashlib
                url_id    = hashlib.md5(url_str.encode("utf-8")).hexdigest()[:12]

                if not url_str or host in seen_hosts:
                    continue
                seen_hosts.add(host)

                severity = "High" if status == "online" else "Medium"
                iocs = [i for i in [url_str[:80], host] if i][:3]

                # Clean timestamp: '2024-03-21 12:34:56 UTC' -> '2024-03-21T12:34:56'
                ts_clean = date_added.replace(" UTC", "").replace(" ", "T") if date_added else "recent"

                item = ThreatFeedItem(
                    id=f"urlhaus_{url_id}",
                    title=f"Malicious URL: {host or url_str[:60]}",
                    severity=severity,
                    technique="T1189",
                    tactic="Initial Access",
                    timestamp=_relative_time(ts_clean),
                    source="Abuse.ch URLhaus",
                    source_key="urlhaus",
                    iocs=iocs,
                    frameworks=["ATT&CK", "OWASP"],
                    tags=tags[:4],
                    description=f"Threat: {threat}. Status: {status}.",
                    external_url=r.get("urlhaus_link", ""),
                )
                
                if _sev_to_int(severity) >= _sev_to_int(min_sev):
                    items.append(item)
                    if len(items) >= limit:
                        break
            if len(items) >= limit:
                break

        _store(f"urlhaus_{limit}", items)
        return items

    except Exception as exc:
        logger.warning("URLhaus fetch failed: %s", exc)
        return []


# ── Abuse.ch MalwareBazaar ────────────────────────────────────────────────────

async def fetch_bazaar(client: httpx.AsyncClient) -> List[ThreatFeedItem]:
    """Fetch from MalwareBazaar — recent malware payload hashes."""
    limit = int(RUNTIME_CONFIG.get("osint_limit", 50))
    cached = _cached(f"bazaar_{limit}")
    if cached is not None:
        return cached

    try:
        headers = {'User-Agent': 'autoMITRE Threat Intel Aggregator/1.2'}
        # CSV is public and doesn't require 401 API keys
        resp = await client.get(BAZAAR_CSV, headers=headers, timeout=15.0)
        resp.raise_for_status()
        
        # Parse CSV lines, skipping the header/comments
        lines = resp.text.splitlines()
        entries = []
        for line in lines:
            if not line or line.startswith('#'): continue
            # Format: "first_seen_utc","sha256_hash","md5_hash","sha1_hash",...
            parts = [p.strip(' "') for p in line.split(',')]
            if len(parts) >= 9:
                entries.append({
                    "first_seen": parts[0],
                    "sha256_hash": parts[1],
                    "md5_hash": parts[2],
                    "sha1_hash": parts[3],
                    "reporter": parts[4],
                    "file_name": parts[5],
                    "file_type": parts[6],
                    "signature": parts[8],
                })
    except Exception as exc:
        logger.warning("MalwareBazaar fetch failed: %s", exc)
        return []

    items: List[ThreatFeedItem] = []
    seen_hashes: set = set()
    
    limit = int(RUNTIME_CONFIG.get("osint_limit", 50))
    min_sev = RUNTIME_CONFIG.get("osint_min_severity", "Low")

    for e in entries:
        sha256     = e.get("sha256_hash", "")
        file_name  = e.get("file_name", "")
        file_type  = e.get("file_type", "Unknown")
        signature  = e.get("signature", "")
        first_seen = e.get("first_seen", "")
        tags       = []

        if not sha256 or sha256 in seen_hashes:
            continue
        seen_hashes.add(sha256)

        if signature == "n/a":
            signature = ""

        # Set severity based on signature presence
        # If it has a known malware signature, it's High. Otherwise Medium.
        sev = "High" if signature and signature != "n/a" else "Medium"

        # Determine a label
        label = signature or file_type

        item = ThreatFeedItem(
            id=f"bazaar_{sha256}",
            title=f"Malware Payload: {file_name or label or 'Unknown'} ({file_type})",
            severity=sev,
            technique="T1204",
            tactic="Execution",
            timestamp=_relative_time(first_seen) if first_seen else "recent",
            source="Abuse.ch MalwareBazaar",
            source_key="bazaar",
            iocs=[sha256, e.get("md5_hash", ""), e.get("sha1_hash", "")],
            frameworks=["ATT&CK"],
            tags=[signature] + tags if signature else tags,
            description=f"Malicious {file_type} file detected. Signature: {signature or 'None'}. First seen: {first_seen or 'unknown'}.",
            external_url=f"https://bazaar.abuse.ch/sample/{sha256}/",
        )
        
        # Remove empty IOCs and "n/a"
        item.iocs = [i for i in item.iocs if i and i != "n/a"]
        item.tags = list(set([t for t in item.tags if t and t != "n/a"]))[:5]

        if _sev_to_int(sev) >= _sev_to_int(min_sev):
            items.append(item)
            if len(items) >= limit:
                break

    _store("bazaar", items)
    return items


# ── AlienVault OTX ───────────────────────────────────────────────────────────

async def fetch_otx(client: httpx.AsyncClient) -> List[ThreatFeedItem]:
    key = _get_otx_key()
    if not key:
        logger.info("OTX: No API key configured, skipping.")
        return []

    cache_key = f"otx_{key[:8]}_ref"
    cached = _cached(cache_key)
    if cached is not None:
        return cached

    limit = int(RUNTIME_CONFIG.get("osint_limit", 50))
    min_sev = RUNTIME_CONFIG.get("osint_min_severity", "Low")
    headers = {"X-OTX-API-KEY": key, "User-Agent": "autoMITRE/1.2"}
    items: List[ThreatFeedItem] = []

    # Try subscribed feed first, fall back to global activity feed
    endpoints_to_try = [
        f"{OTX_BASE}/pulses/subscribed",
        f"{OTX_BASE}/pulses/activity",
    ]

    for endpoint in endpoints_to_try:
        if items:
            break  # Already have data from a previous endpoint
        url: Optional[str] = endpoint
        params: Optional[dict] = {"limit": 50}

        while url and len(items) < limit:
            try:
                logger.info(f"OTX: Fetching {url}")
                resp = await client.get(url, headers=headers, params=params, timeout=15.0)
                resp.raise_for_status()
                data = resp.json()
                pulses = data.get("results", [])
                logger.info(f"OTX: {len(pulses)} pulses from {url}")
                url = data.get("next")
                params = None
            except Exception as exc:
                logger.error("OTX fetch failed: %s", exc)
                break

            if not pulses:
                break

            for p in pulses:
                if len(items) >= limit:
                    break
                pulse_id = p.get("id", str(uuid.uuid4()))
                name     = p.get("name", "Unknown pulse")
                created  = p.get("created", "")
                tags     = p.get("tags", [])
                iocs_raw = p.get("indicators", [])
                tlp      = p.get("tlp", "green")

                iocs = [i.get("indicator", "") for i in iocs_raw if i.get("indicator")][:4]

                sev_map  = {"red": "Critical", "amber": "High", "green": "Medium", "white": "Low"}
                severity = sev_map.get(tlp.lower(), "Medium")

                attack_ids  = p.get("attack_ids", [])
                first_attack = attack_ids[0] if attack_ids else None
                if isinstance(first_attack, dict):
                    technique = first_attack.get("id", "")
                    tactic    = (first_attack.get("tactic") or {}).get("name", "")
                elif isinstance(first_attack, str):
                    technique = first_attack
                    tactic    = ""
                else:
                    technique = ""
                    tactic    = ""

                item = ThreatFeedItem(
                    id=f"otx_{pulse_id}",
                    title=name,
                    severity=severity,
                    technique=technique,
                    tactic=tactic or "Intelligence",
                    timestamp=_relative_time(created) if created else "recent",
                    source="AlienVault OTX",
                    source_key="otx",
                    iocs=iocs,
                    frameworks=["ATT&CK"] if technique else [],
                    tags=tags[:4],
                    description=p.get("description", "")[:200],
                    external_url=f"https://otx.alienvault.com/pulse/{pulse_id}",
                )
                if _sev_to_int(severity) >= _sev_to_int(min_sev):
                    items.append(item)

    _store(cache_key, items)
    logger.info(f"OTX: Total items fetched: {len(items)}")
    return items


# ── Public Aggregator ─────────────────────────────────────────────────────────

async def fetch_all_osint(include_misp: bool = True) -> Dict[str, Any]:
    """
    Fetch from all configured OSINT sources concurrently.
    Returns { "items": [...], "sources": { source_key: status } }
    """
    async with httpx.AsyncClient(
        verify=False,         # Some MISP instances use self-signed certs
        follow_redirects=True,
    ) as client:
        tasks = [fetch_urlhaus(client), fetch_bazaar(client), fetch_otx(client)]
        if include_misp:
            tasks.append(fetch_misp(client))

        results = await asyncio.gather(*tasks, return_exceptions=True)

    items: List[ThreatFeedItem] = []
    sources: Dict[str, str] = {}

    source_meta = [
        ("urlhaus",  "Abuse.ch URLhaus"),
        ("bazaar",   "Abuse.ch MalwareBazaar"),
        ("otx",      "AlienVault OTX"),
    ]
    if include_misp:
        source_meta.append(("misp", "MISP"))

    for (key, label), result in zip(source_meta, results):
        if isinstance(result, Exception):
            logger.warning("%s error: %s", label, result)
            sources[key] = "error"
        elif isinstance(result, list):
            items.extend(result)
            sources[key] = "active" if result else "empty"
        else:
            sources[key] = "unknown"

    # Deduplicate by id and sort newest-first
    seen_ids: set = set()
    deduped = []
    for item in items:
        if item.id not in seen_ids:
            seen_ids.add(item.id)
            deduped.append(item)

    # Optional Local Storage
    store_locally = str(RUNTIME_CONFIG.get("osint_store_locally", "false")).lower() == "true"
    if store_locally and deduped:
        try:
            async with SessionLocal() as db:
                from sqlalchemy import or_
                for d in deduped:
                    # Check if it already exists to avoid PK conflict and duplicate titles
                    stmt = select(OSINTFeedItem).filter(or_(OSINTFeedItem.id == d.id, OSINTFeedItem.title == d.title))
                    result = await db.execute(stmt)
                    existing = result.scalars().first()
                    
                    if not existing:
                        new_rec = OSINTFeedItem(
                            id=d.id,
                            title=d.title,
                            severity=d.severity,
                            technique=d.technique,
                            tactic=d.tactic,
                            timestamp=d.timestamp,
                            source=d.source,
                            source_key=d.source_key,
                            iocs=d.iocs,
                            frameworks=d.frameworks,
                            tags=d.tags,
                            description=d.description,
                            external_url=d.external_url,
                        )
                        db.add(new_rec)
                await db.commit()
        except Exception as e:
            logger.error(f"Failed to store OSINT locally: {e}")

    return {
        "items": [i.to_dict() for i in deduped],
        "sources": sources,
    }


# ── Source health check ────────────────────────────────────────────────────────

def get_source_status() -> List[Dict[str, Any]]:
    """Return configuration status of each OSINT source without making API calls."""
    return [
        {
            "key": "misp",
            "label": "MISP",
            "configured": bool(_misp_url() and _misp_key()),
            "url": _misp_url() or None,
            "description": "Malware Information Sharing Platform",
        },
        {
            "key": "urlhaus",
            "label": "Abuse.ch URLhaus",
            "configured": True,      # Always available
            "url": "https://urlhaus.abuse.ch",
            "description": "Real-time malicious URL blocklist",
        },
        {
            "key": "bazaar",
            "label": "Abuse.ch MalwareBazaar",
            "configured": True,
            "url": "https://bazaar.abuse.ch",
            "description": "Malware sample repository",
        },
        {
            "key": "otx",
            "label": "AlienVault OTX",
            "configured": bool(_get_otx_key()),
            "url": "https://otx.alienvault.com",
            "description": "Open Threat Exchange community intelligence",
        },
    ]


# ── Runtime config update (called by settings API) ────────────────────────────

# Maps internal config keys to .env variable names
_ENV_KEY_MAP = {
    "otx_api_key":  "OTX_API_KEY",
    "misp_api_key": "MISP_API_KEY",
    "misp_url":     "MISP_URL",
    "virustotal_api_key": "VIRUSTOTAL_API_KEY",
    "osint_limit":  "OSINT_LIMIT",
    "osint_min_severity": "OSINT_MIN_SEVERITY",
    "osint_store_locally": "OSINT_STORE_LOCALLY",
    "framework_attack": "FRAMEWORK_ATTACK",
    "framework_defend": "FRAMEWORK_DEFEND",
    "framework_nist": "FRAMEWORK_NIST",
    "framework_owasp": "FRAMEWORK_OWASP",
}

def update_runtime_config(key: str, value: str):
    """Update in-process configuration, persist to .env, and invalidate cache."""
    RUNTIME_CONFIG[key] = value

    # Persist to .env file so the value survives server restarts
    env_var = _ENV_KEY_MAP.get(key)
    if env_var:
        try:
            import pathlib
            from dotenv import set_key as dotenv_set_key
            env_path = pathlib.Path(__file__).resolve().parent.parent / ".env"
            dotenv_set_key(str(env_path), env_var, str(value), quote_mode="never")
            logger.info("Persisted %s to .env", env_var)
        except Exception as exc:
            logger.warning("Could not persist %s to .env: %s", env_var, exc)

    # Always clear ALL cache when any API key changes — stale entries block new keys
    if "api_key" in key or "url" in key or key.startswith("osint_"):
        _cache.clear()
        logger.info("Cache cleared after config update: %s", key)
    else:
        for c_key in list(_cache.keys()):
            if key.split("_")[0] in c_key:
                del _cache[c_key]
