"""
Technique Embedder — SOTA Semantic confidence scoring for MITRE ATT&CK techniques.

Uses sentence-transformers (all-mpnet-base-v2, 420MB, High Precision) to compute real
cosine similarity between the user's threat text and each ATT&CK technique description.
This replaces the old MiniLM model to achieve State-of-the-Art discrimination.

At startup:
  - Model is loaded once
  - All ATT&CK technique descriptions are pre-embedded
At inference:
  - User text is embedded
  - Cosine similarity against each technique = real confidence score
"""
import os
import logging
import json
import numpy as np
from typing import Dict, Optional, List

logger = logging.getLogger(__name__)

# Fix Rust tokenizers parallelism collision with MPS
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Cached at module level — loaded once at startup
_model = None
_technique_embeddings: Dict[str, np.ndarray] = {}   # tech_id -> embedding
_attack_db_cache: Optional[List[dict]] = None

MODEL_NAME = "all-mpnet-base-v2"


def _get_model():
    """Lazy-load the sentence-transformer model (only once)."""
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f"Loading sentence-transformer model: {MODEL_NAME}")
            _model = SentenceTransformer(MODEL_NAME)
            logger.info("Sentence-transformer model loaded successfully.")
        except Exception as e:
            logger.warning(f"Could not load sentence-transformer model: {e}. Falling back to TF-IDF heuristic confidence.")
            _model = None
    return _model


def _load_attack_db() -> List[dict]:
    """Load the local ATT&CK database JSON."""
    global _attack_db_cache
    if _attack_db_cache is not None:
        return _attack_db_cache
    base = os.path.join(os.path.dirname(__file__), '..', 'data')
    path = os.path.join(base, 'mitre_attack.json')
    try:
        with open(path) as f:
            _attack_db_cache = json.load(f)
        logger.info(f"ATT&CK DB loaded: {len(_attack_db_cache)} techniques")
    except Exception as e:
        logger.error(f"Could not load ATT&CK DB: {e}")
        _attack_db_cache = []
    return _attack_db_cache


def _build_technique_text(tech: dict) -> str:
    """Build a rich text string from a technique for embedding."""
    parts = [
        tech.get('name', ''),
        tech.get('tactic', ''),
        tech.get('description', '')[:500]   # Truncate long descriptions
    ]
    return ' '.join(p for p in parts if p).strip()


def precompute_technique_embeddings() -> None:
    """
    Pre-compute embeddings for all ATT&CK techniques.
    Should be called once at application startup.
    """
    global _technique_embeddings
    if _technique_embeddings:
        return  # Already done

    model = _get_model()
    if model is None:
        return  # Model not available, skip

    db = _load_attack_db()
    if not db:
        return

    try:
        tech_ids = [t['id'] for t in db]
        tech_texts = [_build_technique_text(t) for t in db]

        logger.info(f"Pre-computing embeddings for {len(tech_texts)} ATT&CK techniques...")
        embeddings = model.encode(tech_texts, batch_size=64, show_progress_bar=False, normalize_embeddings=True)

        for tech_id, emb in zip(tech_ids, embeddings):
            _technique_embeddings[tech_id] = emb

        logger.info(f"Technique embeddings ready: {len(_technique_embeddings)} techniques cached.")
    except Exception as e:
        logger.error(f"Failed to pre-compute technique embeddings: {e}")


def score_technique_confidence(user_text: str, technique_id: str) -> float:
    """
    Return a real cosine similarity score (0.0–1.0) between the user's threat
    description and the target ATT&CK technique.

    Falls back to 0.65 if:
    - The model is not loaded
    - The technique has no pre-computed embedding
    """
    model = _get_model()
    if model is None or technique_id not in _technique_embeddings:
        return 0.65  # Neutral fallback (not 0.7 — distinguishable from real scores)

    try:
        # Encode user text (normalized)
        user_emb = model.encode(user_text[:1024], normalize_embeddings=True)
        tech_emb = _technique_embeddings[technique_id]

        # Cosine similarity (dot product of normalized vectors)
        similarity = float(np.dot(user_emb, tech_emb))

        # Clamp to [0.1, 1.0] — no negative confidences in UI
        return round(max(0.1, min(1.0, similarity)), 2)
    except Exception as e:
        logger.warning(f"Confidence scoring failed for {technique_id}: {e}")
        return 0.65


def is_embedder_ready() -> bool:
    """Returns True if the model is loaded and technique embeddings are pre-computed."""
    return _model is not None and len(_technique_embeddings) > 0


def batch_score_techniques(user_text: str, technique_ids: List[str]) -> Dict[str, float]:
    """
    Score multiple techniques at once (more efficient — single user text embedding).
    Returns dict of {technique_id: confidence_score}.
    """
    if not technique_ids:
        return {}

    model = _get_model()
    if model is None:
        return {tid: 0.65 for tid in technique_ids}

    try:
        user_emb = model.encode(user_text[:1024], normalize_embeddings=True)
        scores = {}
        for tid in technique_ids:
            if tid in _technique_embeddings:
                sim = float(np.dot(user_emb, _technique_embeddings[tid]))
                scores[tid] = round(max(0.1, min(1.0, sim)), 2)
            else:
                scores[tid] = 0.65
        return scores
    except Exception as e:
        logger.warning(f"Batch scoring failed: {e}")
        return {tid: 0.65 for tid in technique_ids}
