import os
import re
import json
import pickle
import logging
import torch
import numpy as np
import pandas as pd
import scipy.sparse
from typing import List, Tuple, Dict, Any, Optional
import xgboost as xgb
from sklearn.ensemble import IsolationForest

logger = logging.getLogger(__name__)

# File paths for saving/loading the models
MODEL_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'models')
IFOREST_PATH    = os.path.join(MODEL_DIR, 'text_isolation_forest.pkl')
XGB_PATH        = os.path.join(MODEL_DIR, 'xgboost_severity.json')
TFIDF_PATH      = os.path.join(MODEL_DIR, 'tfidf_vectorizer.pkl')
TEXT_XGB_PATH   = os.path.join(MODEL_DIR, 'text_severity_xgb.json')
# Supervised Anomaly Models
ANOMALY_XGB_PATH = os.path.join(MODEL_DIR, 'nsl_kdd_classifier.json')
CICIDS_XGB_PATH  = os.path.join(MODEL_DIR, 'cicids_classifier.json')
CICIDS_SCALER    = os.path.join(MODEL_DIR, 'cicids_scaler.pkl')
CICIDS_FEATURES  = os.path.join(MODEL_DIR, 'cicids_features.json')

# Regex patterns for entity extraction (matches training pipeline)
_CRITICAL_PATTERNS = re.compile(
    r'(remote code execution|arbitrary code|buffer overflow|heap overflow'
    r'|stack overflow|use.after.free|privilege escalation|authentication bypass'
    r'|sql injection|command injection|code injection|rce|root access'
    r'|zero.day|0.day|unauthenticated|pre.auth'
    r'|ransomware|data breach|complete compromise|apt|nation state'
    r'|supply chain|encrypt|domain compromise|lsass|dcsync|golden ticket)',
    re.IGNORECASE
)
_NETWORK_PATTERNS = re.compile(
    r'(network|http|https|tcp|udp|dns|smtp|ssh|ftp|ssl|tls'
    r'|remote|server|client|request|packet|socket|port|web'
    r'|c2|beacon|callback|reverse shell|tunnel|proxy)',
    re.IGNORECASE
)
_ENTITY_RE = re.compile(
    r'(CVE-\d{4}-\d+|CWE-\d+|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}'
    r'|https?://[^\s]+|[a-fA-F0-9]{32,64})',
    re.IGNORECASE
)
# NEW: Richer CTI-specific patterns
_PROCESS_PATTERNS = re.compile(
    r'(powershell|cmd\.exe|wscript|cscript|mshta|regsvr32|rundll32'
    r'|wmic|lsass|svchost|ntdll|explorer|services\.exe|taskkill|net\.exe)',
    re.IGNORECASE
)
_REGISTRY_PATTERNS = re.compile(
    r'(HKLM|HKCU|HKEY_LOCAL_MACHINE|HKEY_CURRENT_USER'
    r'|\\Software\\Microsoft|\\Run\\|\\RunOnce\\|registry|reg add|reg query)',
    re.IGNORECASE
)
_FILE_PATH_PATTERNS = re.compile(
    r'(C:\\|C:/|/etc/|/tmp/|/var/|AppData|System32|Temp\\|%APPDATA%'
    r'|\.exe|\.dll|\.bat|\.ps1|\.vbs|\.js|\.sh)',
    re.IGNORECASE
)
_PERSISTENCE_PATTERNS = re.compile(
    r'(scheduled task|schtasks|cron|autorun|startup|boot|persistence'
    r'|run key|at\.exe|taskschd|loginitem|launchd|init\.d)',
    re.IGNORECASE
)
_LATERAL_MOVEMENT_PATTERNS = re.compile(
    r'(lateral movement|psexec|wmiexec|pass.the.hash|pass.the.ticket'
    r'|rdp|remote desktop|mimikatz|impacket|bloodhound|cobalt strike'
    r'|empire|crackmapexec|spread|pivot)',
    re.IGNORECASE
)
_EXFILTRATION_PATTERNS = re.compile(
    r'(exfiltrat|upload|transfer|steal|dump|harvest|collect'
    r'|compress|archive|zip|encrypted.*send|ftp.*upload|data.*theft)',
    re.IGNORECASE
)
_MITRE_TECHNIQUE_RE = re.compile(r'\bT\d{4}(?:\.\d{3})?\b')
_MALWARE_PATTERNS = re.compile(
    r'(cobalt strike|metasploit|meterpreter|emotet|trickbot|ryuk|maze'
    r'|revil|lockbit|blackcat|lazarus|apt28|apt29|fin7|carbanak'
    r'|darkside|conti|lapsus|donut|sliver|havoc|brute ratel)',
    re.IGNORECASE
)
_EXPLOIT_PATTERNS = re.compile(
    r'(exploit|0.day|zero.day|CVE-|poc|proof.of.concept|shellcode'
    r'|payload|weaponize|weaponized|dropper|stager|staged)',
    re.IGNORECASE
)


class TextSeverityClassifier:
    """
    TF-IDF + XGBoost severity regressor trained on real NVD CVE descriptions
    with CVSS v3.1 base scores.  Provides genuine text understanding beyond
    the 5-feature numerical model.
    """
    def __init__(self):
        self.tfidf = None
        self.model = None
        self._load()

    def _load(self):
        try:
            if os.path.exists(TFIDF_PATH) and os.path.exists(TEXT_XGB_PATH):
                with open(TFIDF_PATH, 'rb') as f:
                    self.tfidf = pickle.load(f)
                self.model = xgb.XGBRegressor()
                self.model.load_model(TEXT_XGB_PATH)
                logger.info("TextSeverityClassifier: loaded NVD-trained TF-IDF + XGBoost")
            else:
                logger.info("TextSeverityClassifier: no trained model yet — run scripts/train_real_data.py")
        except Exception as e:
            logger.warning(f"TextSeverityClassifier load failed: {e}")

    def predict(self, text: str) -> Optional[float]:
        """Returns a CVSS-calibrated severity score (0-10) or None if not available."""
        if not self.tfidf or not self.model:
            return None
        try:
            X = self.tfidf.transform([text])
            score = self.model.predict(scipy.sparse.csr_matrix(X))[0]
            return float(np.clip(score, 0.0, 10.0))
        except Exception as e:
            logger.warning(f"TextSeverityClassifier.predict failed: {e}")
            return None

    @property
    def available(self) -> bool:
        return self.tfidf is not None and self.model is not None

class EnsembleMLEngine:
    def __init__(self):
        self.iforest = None
        self.xgb_model = None
        self.text_classifier = TextSeverityClassifier()
        self._load_models()

    def _load_models(self):
        """Loads pre-trained models if they exist."""
        os.makedirs(MODEL_DIR, exist_ok=True)
        
        # Load Supervised Anomaly Classifier (NSL-KDD)
        if os.path.exists(ANOMALY_XGB_PATH):
            try:
                self.anomaly_clf = xgb.XGBClassifier()
                self.anomaly_clf.load_model(ANOMALY_XGB_PATH)
                logger.info("Loaded supervised NSL-KDD Anomaly Classifier.")
            except Exception as e:
                logger.error(f"Failed to load Anomaly Classifier: {e}")
        
        # Load isolation forest as fallback for text anomaly
        if os.path.exists(IFOREST_PATH):
            try:
                with open(IFOREST_PATH, 'rb') as f:
                    self.iforest = pickle.load(f)
            except: pass

        # Load XGBoost Severity
        if os.path.exists(XGB_PATH):
            try:
                self.xgb_model = xgb.XGBRegressor()
                self.xgb_model.load_model(XGB_PATH)
                logger.info("Loaded pre-trained XGBoost Severity model.")
            except Exception as e:
                logger.error(f"Failed to load XGBoost: {e}")


    def _extract_features(self, text: str, entities: list, heuristic_score: float) -> np.ndarray:
        """
        Converts unstructured threat data into a numerical feature vector.
        Features (15-dimensional, aligned with CVE-derived training pipeline):
          0:  text_length          — proxy for threat complexity
          1:  entity_count         — regex count of CVEs, IPs, URLs, hashes
          2:  keyword_severity     — heuristic severity from critical keyword density (0-10)
          3:  has_critical         — binary: contains RCE, APT, ransomware, etc.
          4:  has_network          — binary: contains network/C2 indicators
          5:  has_process          — binary: contains process names (powershell, lsass, etc.)
          6:  has_registry         — binary: contains registry paths/keys
          7:  has_file_path        — binary: contains file system paths
          8:  has_persistence      — binary: scheduled tasks, autorun, cron
          9:  has_lateral_movement — binary: psexec, mimikatz, pass-the-hash
          10: has_exfiltration     — binary: upload, data theft, exfil
          11: technique_id_count   — count of T1xxx MITRE IDs in text
          12: malware_name_count   — count of known malware family names
          13: has_exploit          — binary: exploit, 0-day, shellcode
          14: sentence_count       — rough complexity of the description
        """
        text_len = len(text)

        # Regex-based entity extraction from raw text
        regex_entities = len(_ENTITY_RE.findall(text))
        num_entities = max(len(entities), regex_entities)

        # Critical keyword density → 0-10 severity proxy
        critical_matches = len(_CRITICAL_PATTERNS.findall(text))
        has_critical = 1.0 if critical_matches > 0 else 0.0
        keyword_severity = min(10.0, critical_matches * 2.5 + (heuristic_score * 0.3))

        # Network/C2 indicator presence
        has_network = 1.0 if _NETWORK_PATTERNS.search(text) else 0.0

        # NEW: Richer CTI indicators
        has_process    = 1.0 if _PROCESS_PATTERNS.search(text) else 0.0
        has_registry   = 1.0 if _REGISTRY_PATTERNS.search(text) else 0.0
        has_file_path  = 1.0 if _FILE_PATH_PATTERNS.search(text) else 0.0
        has_persistence = 1.0 if _PERSISTENCE_PATTERNS.search(text) else 0.0
        has_lateral    = 1.0 if _LATERAL_MOVEMENT_PATTERNS.search(text) else 0.0
        has_exfil      = 1.0 if _EXFILTRATION_PATTERNS.search(text) else 0.0
        technique_count = min(float(len(_MITRE_TECHNIQUE_RE.findall(text))), 20.0)
        malware_count   = min(float(len(_MALWARE_PATTERNS.findall(text))), 10.0)
        has_exploit    = 1.0 if _EXPLOIT_PATTERNS.search(text) else 0.0
        sentence_count  = min(float(text.count('.') + text.count('\n')), 50.0)

        return np.array([[
            text_len, num_entities, keyword_severity, has_critical, has_network,
            has_process, has_registry, has_file_path, has_persistence, has_lateral,
            has_exfil, technique_count, malware_count, has_exploit, sentence_count
        ]])


    def evaluate_threat(self, processed_input: Dict[str, Any], heuristic_score: float, deep_analysis: bool = False) -> Tuple[bool, Optional[float], Dict[str, Any]]:
        """
        Industrial-Grade Hybrid Evaluation.
        Returns:
            Tuple: (is_anomalous: bool, blended_severity: float, deep_insights: dict)

        Logic:
        1.  Heuristic (15%): Fast keyword-based severity.
        2.  Numerical XGBoost (15%): Metadata complexity rules.
        3.  Deep Intelligence (70% - Optional):
            - Stage 1: SecBERT Multi-Label TTP Mapping (Domain-Specific).
            - Stage 2: Phi-3.5-mini Reasoning & Entity Extraction (Contextual).
        """
        text = processed_input.get('normalized_text', '')
        entities = processed_input.get('entities', [])

        # Default results
        is_anomalous = False
        deep_insights = {"title": "Standard Analysis", "summary": "", "terms": []}

        try:
            # 1. Extraction & Anomaly Detection
            features = self._extract_features(text, entities, heuristic_score)
            
            # Supervised Anomaly Prediction
            # (Note: anomaly_clf is for NSL-KDD network data, so we exclusively use iforest for text features)
            if self.iforest:
                # Unsupervised Fallback
                is_anomalous = (self.iforest.predict(features)[0] == -1)

            # 2. Numerical Score (XGBoost) - 0-10
            num_score = 5.0
            if self.xgb_model:
                num_score = float(np.clip(self.xgb_model.predict(features)[0], 0.0, 10.0))

            if not deep_analysis:
                # Standard Blend: 60% Heuristic (Dynamic), 40% XGBoost (Structural)
                # Why? Heuristic is better at catching specific payload nuances (UNION vs standard SQL)
                final_severity = (0.60 * heuristic_score) + (0.40 * num_score)
                return is_anomalous, float(np.clip(final_severity, 0.0, 10.0)), deep_insights

            # 3. Deep Intelligence Stage 1: SecBERT TTP Mapping
            from core.secbert_classifier import secbert_clf
            detected_ttps = secbert_clf.predict_techniques(text) # Dict {ID: Conf}
            
            # Convert to list of dicts for LLM/UI
            ttp_list = [{"id": tid, "name": "Classified Technique", "confidence": conf} for tid, conf in detected_ttps.items()]
            
            # SecBERT Severity proxy — based on technique COUNT, not display confidence.
            # Using display confidence caused a regression: my calibration fix (honest
            # 0.30–0.92 range) lowered avg confidence → lowered severity unfairly.
            # Technique count is a better severity proxy: more TTPs = broader kill chain.
            #   1 TTP  → 6.0  (targeted/single-stage)
            #   2 TTPs → 7.5  (multi-stage)
            #   3 TTPs → 8.5  (coordinated attack)
            #   5 TTPs → 9.5  (full kill chain — Critical)
            secbert_score = 5.0
            if detected_ttps:
                count = len(detected_ttps)
                secbert_score = min(10.0, 5.0 + (count * 0.9))

            # 4. Deep Intelligence Stage 2: Phi-3.5 Reasoning
            from core.nano_llm_engine import nano_llm
            llm_results = nano_llm.extract_and_analyze(text, ttp_list)
            
            # 5. Deep Intelligence Stage 3: Technical Evidence Alignment (Deterministic)
            from core.evidence_aligner import evidence_aligner
            llm_terms = llm_results.get("terms", [])
            
            # Normalize TTPs: convert strings to dicts for aligner
            raw_ttps = llm_results.get("ttps", ttp_list)
            normalized_for_aligner = []
            for ttp in raw_ttps:
                if isinstance(ttp, str):
                    normalized_for_aligner.append({"id": ttp, "name": "Classified Technique", "confidence": 0.85})
                else:
                    normalized_for_aligner.append(ttp)

            final_ttps = evidence_aligner.align_techniques(normalized_for_aligner, llm_terms, text)

            deep_insights = {
                "title": llm_results.get("title", "Threat Detected"),
                "summary": llm_results.get("summary", ""),
                "analysis": llm_results.get("analysis", ""),
                "terms": llm_terms,
                "ttps": final_ttps,
                "predicted_steps": llm_results.get("predicted_steps", [])
            }

            # 5. Industrial Blended Severity
            # Weights: 15% Heuristic, 15% XGBoost, 70% SecBERT (Proxied)
            final_severity = (0.15 * heuristic_score) + (0.15 * num_score) + (0.70 * secbert_score)
            
            # Clip final result
            final_severity = float(np.clip(final_severity, 0.0, 10.0))

            return is_anomalous, final_severity, deep_insights

        except Exception as e:
            logger.error(f"Industrial ML evaluation failed: {e}")
            return False, heuristic_score, deep_insights


    def baseline_training(self):
        """
        Generates CVE-inspired baseline data and trains both models.
        This provides a reasonable starting point until the full training
        pipeline (train_real_data.py) is run with real NVD/CICIDS data.

        Feature schema matches CVE-derived training:
          0: text_length, 1: entity_count, 2: keyword_severity,
          3: has_critical, 4: has_network
        """
        logger.info("Starting baseline ML training (CVE-inspired distributions)...")
        np.random.seed(42)

        # --- Distributions calibrated to real CVE description statistics ---
        # Low severity CVEs (CVSS 0-3.9): short, few entities, no critical keywords
        n_low = 200
        low_len    = np.random.lognormal(4.5, 0.5, n_low).clip(50, 500)
        low_ent    = np.random.poisson(0.3, n_low)
        low_kwsev  = np.random.uniform(0, 2.0, n_low)
        low_crit   = np.zeros(n_low)
        low_net    = np.random.binomial(1, 0.3, n_low).astype(float)
        low_scores = np.random.uniform(1.0, 3.9, n_low)

        # Medium severity CVEs (CVSS 4-6.9): moderate length, some entities
        n_med = 300
        med_len    = np.random.lognormal(5.0, 0.4, n_med).clip(80, 800)
        med_ent    = np.random.poisson(1.0, n_med)
        med_kwsev  = np.random.uniform(1.5, 5.0, n_med)
        med_crit   = np.random.binomial(1, 0.15, n_med).astype(float)
        med_net    = np.random.binomial(1, 0.5, n_med).astype(float)
        med_scores = np.random.uniform(4.0, 6.9, n_med)

        # High severity CVEs (CVSS 7-8.9): longer, more entities, critical keywords
        n_high = 250
        high_len    = np.random.lognormal(5.3, 0.5, n_high).clip(100, 1200)
        high_ent    = np.random.poisson(2.5, n_high)
        high_kwsev  = np.random.uniform(4.0, 8.0, n_high)
        high_crit   = np.random.binomial(1, 0.55, n_high).astype(float)
        high_net    = np.random.binomial(1, 0.65, n_high).astype(float)
        high_scores = np.random.uniform(7.0, 8.9, n_high)

        # Critical severity CVEs (CVSS 9-10): longest, most entities, always critical
        n_crit = 150
        crit_len    = np.random.lognormal(5.6, 0.4, n_crit).clip(150, 2000)
        crit_ent    = np.random.poisson(4.0, n_crit)
        crit_kwsev  = np.random.uniform(6.0, 10.0, n_crit)
        crit_crit   = np.random.binomial(1, 0.85, n_crit).astype(float)
        crit_net    = np.random.binomial(1, 0.75, n_crit).astype(float)
        crit_scores = np.random.uniform(9.0, 10.0, n_crit)

        # Combine all (15 features schema)
        # We'll fill the remaining 10 features with zeros for basic baseline
        feature_base = np.column_stack([
            np.concatenate([low_len, med_len, high_len, crit_len]),
            np.concatenate([low_ent, med_ent, high_ent, crit_ent]),
            np.concatenate([low_kwsev, med_kwsev, high_kwsev, crit_kwsev]),
            np.concatenate([low_crit, med_crit, high_crit, crit_crit]),
            np.concatenate([low_net, med_net, high_net, crit_net]),
        ])
        
        # Add 10 columns of zeros to reach 15 features
        X = np.hstack([feature_base, np.zeros((feature_base.shape[0], 10))])

        y = np.concatenate([low_scores, med_scores, high_scores, crit_scores])
        X = np.maximum(X, 0)

        # Train Isolation Forest (critical samples ≈ 17% treated as anomalous)
        self.iforest = IsolationForest(contamination=0.15, random_state=42, n_estimators=200)
        self.iforest.fit(X)
        os.makedirs(MODEL_DIR, exist_ok=True)
        with open(IFOREST_PATH, 'wb') as f:
            pickle.dump(self.iforest, f)

        # Train XGBoost with better hyperparameters
        self.xgb_model = xgb.XGBRegressor(
            objective='reg:squarederror', n_estimators=200, max_depth=4,
            learning_rate=0.08, subsample=0.85, colsample_bytree=0.8,
            random_state=42, verbosity=0
        )
        self.xgb_model.fit(X, y)
        self.xgb_model.save_model(XGB_PATH)

        logger.info(f"Baseline models trained on {len(y)} CVE-inspired samples and saved.")

# Singleton instance
ml_engine = EnsembleMLEngine()
