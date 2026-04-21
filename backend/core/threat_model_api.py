import httpx
import json
from models.schemas import ExtractedAttack

async def fetch_iriusrisk_threats(instance_url: str, api_token: str, project_id: str) -> str:
    """
    Fetches the raw JSON representation of threats from an IriusRisk project.
    Returns a structured text snippet ready for LLM extraction.
    """
    base_url = instance_url.rstrip("/")
    endpoint = f"{base_url}/api/v1/products/{project_id}/threats"
    headers = {
        "api-token": api_token,
        "Accept": "application/json"
    }

    async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
        try:
            response = await client.get(endpoint, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            # Condense the JSON payload into a focused text structure for the LLM
            formatted_text = f"IriusRisk Threat Model (Project: {project_id})\n\n"
            if isinstance(data, list):
                for item in data:
                    name = item.get("name", item.get("referenceId", "Unknown Threat"))
                    desc = item.get("desc", item.get("description", ""))
                    risk = item.get("risk", "Unknown")
                    formatted_text += f"---\nAttack Type: {name}\nSeverity: {risk}\nDetails: {desc}\n"
            else:
                formatted_text += json.dumps(data, indent=2)[:50000] # Fallback dump
                
            return formatted_text
        except Exception as e:
            raise ValueError(f"IriusRisk API Connection Failed: {str(e)}")


async def fetch_threat_dragon_url(json_url: str) -> str:
    """
    Fetches a public Threat Dragon JSON payload.
    """
    async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
        try:
            response = await client.get(json_url)
            response.raise_for_status()
            data = response.json()
            
            formatted_text = f"Threat Dragon Model\n\n"
            
            # Simple heuristic traversal to find threat definitions
            threats_found = []
            def extract_threats(node):
                if isinstance(node, dict):
                    if "threats" in node and isinstance(node["threats"], list):
                        threats_found.extend(node["threats"])
                    for v in node.values():
                        extract_threats(v)
                elif isinstance(node, list):
                    for item in node:
                        extract_threats(item)
            
            extract_threats(data)
            
            if threats_found:
                for t in threats_found:
                    title = t.get("title", "Unknown Threat")
                    desc = t.get("description", "")
                    sev = t.get("severity", "Medium")
                    formatted_text += f"---\nAttack Type: {title}\nSeverity: {sev}\nDetails: {desc}\n"
            else:
                formatted_text += json.dumps(data, indent=2)[:50000]
                
            return formatted_text
        except Exception as e:
            raise ValueError(f"Threat Dragon URL fetch failed: {str(e)}")
