import os
import json
import logging
import httpx
from typing import List, Dict, Any, Optional

try:
    from llama_cpp import Llama
    _LLAMA_CPP_AVAILABLE = True
except ImportError:
    _LLAMA_CPP_AVAILABLE = False

from dotenv import load_dotenv

# Load .env variables
load_dotenv()

log = logging.getLogger("nano_llm")

# Model configurations
LOCAL_MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "Phi-3.5-mini-instruct-Q4_K_M.gguf")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = "llama-3.1-8b-instant"

class NanoLLMEngine:
    """
    Stage 2 Industrial-Grade Reasoning Engine.
    Hybrid setup: Uses Groq Cloud Llama 3 (Ultra-Fast) if API key exists,
    otherwise falls back to local Phi-3.5-mini via llama-cpp-python.
    """
    def __init__(self):
        self.local_llm = None
        self.is_local_loaded = False
        # Read the key at init time (after load_dotenv has run), not at module level
        _key = os.getenv("GROQ_API_KEY") or GROQ_API_KEY
        self.use_cloud = bool(_key)
        
        if self.use_cloud:
            log.info("NanoLLMEngine: Cloud Llama 3 (Groq) enabled. Low latency, 0 local memory load.")
        else:
            log.info("NanoLLMEngine: Falling back to Local Phi-3.5 (Metal Acceleration).")

    def load_local(self):
        if self.is_local_loaded:
            return True

        if not _LLAMA_CPP_AVAILABLE:
            log.warning("llama_cpp not installed — local Phi-3.5 unavailable.")
            return False

        if not os.path.exists(LOCAL_MODEL_PATH):
            log.warning(f"Phi-3.5-mini GGUF not found at {LOCAL_MODEL_PATH}.")
            return False

        try:
            log.info(f"Loading local Phi-3.5-mini from {LOCAL_MODEL_PATH}...")
            self.local_llm = Llama(
                model_path=LOCAL_MODEL_PATH,
                n_gpu_layers=-1,
                n_ctx=4096,
                verbose=False
            )
            self.is_local_loaded = True
            log.info("Local Phi-3.5-mini successfully loaded.")
            return True
        except Exception as e:
            log.error(f"Failed to load local Phi-3.5-mini: {e}")
            return False

    def _query_groq(self, prompt: str) -> Optional[str]:
        """Query Groq Cloud Llama 3 API."""
        api_key = os.getenv("GROQ_API_KEY") or GROQ_API_KEY
        if not api_key:
             return None
             
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "model": GROQ_MODEL,
                        "messages": [
                            {"role": "system", "content": "You are an industrial-grade Cyber Threat Intelligence analyst. Output ONLY valid JSON."},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.1,
                        "response_format": {"type": "json_object"}
                    }
                )
                if response.status_code == 200:
                    return response.json()['choices'][0]['message']['content']
                else:
                    log.error(f"Groq API Error: {response.status_code} - {response.text}")
                    return None
        except Exception as e:
            log.error(f"Cloud request failed: {e}")
            return None

    def extract_and_analyze(self, raw_text: str, techniques: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Industrial-grade reasoning:
        1. Analyzes raw text for hidden cybersecurity terms.
        2. Correlates findings with SecBERT's TTP detections.
        3. Generates deep technical narrative (Llama 3 Cloud or Phi-3.5 Local).
        """
        tech_context = ", ".join([f"{t.get('id', '')} ({t.get('name', '')})" for t in techniques])
        
        prompt = (
            f"Analyst report format JSON object with these 6 keys:\n"
            f"1. 'title': Professional threat title.\n"
            f"2. 'summary': 2-sentence executive summary.\n"
            f"3. 'analysis': Deep technical dive (300+ words) into methods, impact, and attribution.\n"
            f"4. 'extracted_terms': List of IPs, hostnames, or specific tools.\n"
            f"5. 'detected_techniques': List of MITRE ATT&CK technique IDs (e.g. ['T1190', 'T1021.001', 'T1048']).\n"
            f"6. 'predicted_steps': List of objects [{{'id': 1, 'title': 'Short Title', 'description': 'Full analyst reasoning', 'confidence': 0.9}}] describing the attacker's likely next actions.\n\n"
            f"REPORT:\n{raw_text}\n\n"
            f"CONTEXT (Already detected TTPs): {tech_context}"
        )

        # Check cloud status dynamically
        use_cloud = bool(os.getenv("GROQ_API_KEY")) or self.use_cloud
        
        # Attempt Cloud First (Llama 3)
        if use_cloud:
            cloud_response = self._query_groq(prompt)
            if cloud_response:
                return self._parse_json_result(cloud_response, techniques)
            else:
                log.warning("Cloud Llama 3 failed. Falling back to local/static.")

        # Local Fallback (Phi-3.5)
        if self.load_local():
            try:
                # Phi-3.5 prompt format
                local_prompt = f"<|system|>\nYou are a CTI analyst. JSON ONLY.<|user|>\n{prompt}\nJSON OUTPUT:\n<|assistant|>\n{{"
                output = self.local_llm(local_prompt, max_tokens=600, temperature=0.1, stop=["<|end|>"])
                return self._parse_json_result("{" + output['choices'][0]['text'], techniques)
            except Exception as e:
                log.error(f"Local inference failed: {e}")

        return self._fallback_narrative(techniques)

    def _parse_json_result(self, text: str, techniques: list) -> dict:
        """
        Robust JSON parsing for LLM output.
        The LLM (Groq Llama-3) performs dynamic technique expansion:
        it receives the 5 SecBERT baseline techniques as context and adds
        further relevant MITRE ATT&CK IDs it reasons from the text.
        This is intentional — Groq gives 8+ results, local Phi-3.5 gives 5.
        """
        try:
            # Clean up potential markdown
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            
            # Find JSON block
            start = text.find('{')
            end = text.rfind('}') + 1
            if start != -1 and end != -1:
                parsed = json.loads(text[start:end])

                # Merge LLM-detected techniques with SecBERT baseline.
                # Groq reasons over the full CTI context and adds techniques
                # beyond SecBERT's top-5 — this is the intended expansion.
                new_tids = [tid for tid in parsed.get("detected_techniques", []) if isinstance(tid, str)]
                all_ttps = techniques.copy()
                existing_ids = {t.get("id") for t in all_ttps if isinstance(t, dict)}
                
                for tid in new_tids:
                    if tid not in existing_ids:
                        all_ttps.append(tid)
                        existing_ids.add(tid)

                return {
                    "title": parsed.get("title", "AI Analysis Report"),
                    "summary": parsed.get("summary", "Technical threat detected."),
                    "analysis": parsed.get("analysis", "No deep analysis available."),
                    "terms": parsed.get("extracted_terms", parsed.get("terms", [])),
                    "ttps": all_ttps,
                    "predicted_steps": parsed.get("predicted_steps", [])
                }
        except Exception as e:
            log.warning(f"JSON Parse Error: {e}")
        
        return self._fallback_narrative(techniques)

    def identify_attacks(self, raw_text: str) -> List[Dict[str, Any]]:
        """
        Reads a raw file content (or PCAP text parsed output) and extracts a list of discrete attacks.
        Returns a list of dictionaries matching the ExtractedAttack schema.
        """
        # Multi-tiered Truncation: 
        # Cloud (Groq) can handle more, but Local (Phi-3.5) is capped at 4k tokens.
        # 12k chars is ~3k-4k tokens. 6k chars is safer for local.
        is_cloud = bool(os.getenv("GROQ_API_KEY")) or self.use_cloud
        max_chars = 12000 if is_cloud else 6000
        safe_text = raw_text[:max_chars] if len(raw_text) > max_chars else raw_text

        prompt = (
            f"SYSTEM: You are a Tier-3 SOC Lead. Your task is to identify and list EXACT attack names from the raw packet/log data below.\n"
            f"RULES:\n"
            f"1. Be extremely specific (e.g., 'SQL Injection (OR 1=1)', 'Nmap Scan', 'Log4Shell Attempt').\n"
            f"2. If multiple IPs are doing different things, list them as separate attacks.\n"
            f"3. Return ONLY a valid JSON object. DO NOT include any text before or after the JSON.\n"
            f"JSON FORMAT:\n"
            f"{{\n"
            f"  \"attacks\": [\n"
            f"    {{ \"id\": \"id\", \"title\": \"EXACT ATTACK NAME\", \"description\": \"Summary of target and intent\", \"severity_estimate\": \"Critical/High/Medium/Low\", \"raw_snippet\": \"relevant packet/log snippet\" }}\n"
            f"  ]\n"
            f"}}\n\n"
            f"DATA TO EXTRACT FROM:\n{safe_text}\n"
        )
        
        use_cloud = bool(os.getenv("GROQ_API_KEY")) or self.use_cloud
        def clean_and_parse(text_in):
            if not text_in: return []
            try:
                # Remove markdown blocks
                if "```json" in text_in:
                    text_in = text_in.split("```json")[1].split("```")[0]
                elif "```" in text_in:
                    text_in = text_in.split("```")[1].split("```")[0]
                
                # Strip control characters
                text_in = "".join(ch for ch in text_in if ord(ch) >= 32 or ch in "\n\r\t")
                
                # Find first { and matching last }
                # Note: rfind might fail if there's trailing junk like "Here is the JSON: {}"
                # We slice based on first { and last }
                start = text_in.find('{')
                end = text_in.rfind('}') + 1
                if start == -1 or end == 0:
                    return []
                
                json_str = text_in[start:end].strip()
                parsed = json.loads(json_str)
                attacks = parsed.get("attacks", [])
                return [a for a in attacks if isinstance(a, dict) and "raw_snippet" in a]
            except Exception as e:
                log.warning(f"JSON Parse Error: {e} | Content starts with: {text_in[:50]}...")
                return []

        if use_cloud:
            cloud_response = self._query_groq(prompt)
            results = clean_and_parse(cloud_response)
            if results: return results

        # Local Fallback
        try:
            local_prompt = f"<|system|>\nYou are a CTI analyst. JSON ONLY.<|user|>\n{prompt}\nJSON OUTPUT:\n<|assistant|>\n{{"
            output = self.local_llm(local_prompt, max_tokens=1000, temperature=0.1, stop=["<|end|>", "}"], include_stop=True)
            
            if output and output['choices']:
                text = "{" + output['choices'][0]['text']
                results = clean_and_parse(text)
                if results: return results
        except Exception as e:
            log.warning(f"Local inference failed in identify_attacks: {e}")

        # Ultimate fallback
        return [{
            "id": "attack-1",
            "title": "General Threat Activity",
            "description": "The system detected suspicious patterns but could not separate them into discrete incidents. Proceeding with a full-file assessment.",
            "severity_estimate": "Medium",
            "raw_snippet": raw_text[:2000]
        }]

    def _fallback_narrative(self, techniques: list) -> dict:
        return {
            "title": "Industrial Threat Insight",
            "summary": "Threat detected and mapped to ATT&CK.",
            "analysis": "AI Reasoning modules (Cloud/Local) are currently restricted. Review manual TTP alignments below.",
            "terms": [],
            "ttps": techniques
        }

# Singleton instance
nano_llm = NanoLLMEngine()
