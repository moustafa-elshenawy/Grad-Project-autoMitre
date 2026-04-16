"""
autoMITRE v1.2 — Full AI Pipeline Evaluation
============================================
Computes Accuracy, Precision, Recall, F1-Score, and Confusion Matrices for:
  1. Heuristic Threat Classifier  (rule-based keyword engine)
  2. SecBERT Tactic Classifier    (fine-tuned BERT on ATT&CK tactics)
  3. Semantic Technique Embedder  (MiniLM cosine-similarity mapper)
  4. Full Hybrid Pipeline         (combined pipeline output)

Uses the labelled datasets in backend/data/training_data/
"""

import os, sys, json, random, time
import pandas as pd
import numpy as np
from collections import defaultdict

# ── Add backend to path ──────────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))

from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, confusion_matrix, classification_report
)
from sklearn.preprocessing import LabelEncoder

# MITRE tactic name → shorthand set used by heuristic engine
TACTIC_TO_CATEGORY = {
    "Defense Evasion":       ["malware_backdoor_trojan", "web_attack"],
    "Execution":             ["web_attack", "malware_backdoor_trojan", "command_control"],
    "Collection":            ["data_exfiltration"],
    "Lateral Movement":      ["lateral_movement"],
    "Persistence":           ["persistence"],
    "Credential Access":     ["credential_dumping", "credential_brute_force",
                               "credential_pass_hash", "credential_kerberos"],
    "Discovery":             ["discovery", "network_attack"],
    "Resource Development":  ["network_attack"],
    "Command And Control":   ["command_control"],
    "Reconnaissance":        ["network_attack", "discovery"],
    "Privilege Escalation":  ["privilege_escalation"],
    "Impact":                ["impact", "malware_ransomware"],
    "Exfiltration":          ["data_exfiltration"],
    "Initial Access":        ["web_attack", "malware_backdoor_trojan"],
}

CATEGORY_TO_TACTIC = {}
for tactic, cats in TACTIC_TO_CATEGORY.items():
    for cat in cats:
        if cat not in CATEGORY_TO_TACTIC:
            CATEGORY_TO_TACTIC[cat] = tactic

TACTIC_LABELS = sorted(TACTIC_TO_CATEGORY.keys())

print("=" * 70)
print("  autoMITRE v1.2 — AI Pipeline Evaluation Report")
print("=" * 70)
print()

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 1: Heuristic Engine on log_analysis.csv (Benign vs Malicious)
# ─────────────────────────────────────────────────────────────────────────────
print("▶  [1/4] HEURISTIC ENGINE — Binary Threat Classifier")
print("   Dataset: log_analysis.csv  (3,003 samples)")
print("-" * 70)

from core.ai_threat_analyzer import THREAT_SIGNATURES, calculate_confidence

log_df = pd.read_csv("data/training_data/log_analysis.csv").dropna()

# Sample a balanced subset: all 3 true malicious + 200 benign
malicious_rows = log_df[log_df["label"] == "Malicious"]
benign_rows    = log_df[log_df["label"] == "Benign"].sample(n=400, random_state=42)
eval_log = pd.concat([malicious_rows, benign_rows]).reset_index(drop=True)

true_binary = []
pred_binary = []

for _, row in eval_log.iterrows():
    text  = str(row["log_text"])
    label = str(row["label"])
    true_binary.append(1 if label == "Malicious" else 0)

    # Run heuristic engine
    is_threat = False
    for sig in THREAT_SIGNATURES.values():
        if calculate_confidence(text, sig["keywords"]) > 0.58:
            is_threat = True
            break
    pred_binary.append(1 if is_threat else 0)

acc_h  = accuracy_score(true_binary, pred_binary)
prec_h = precision_score(true_binary, pred_binary, zero_division=0)
rec_h  = recall_score(true_binary, pred_binary, zero_division=0)
f1_h   = f1_score(true_binary, pred_binary, zero_division=0)
cm_h   = confusion_matrix(true_binary, pred_binary)

print(f"   Accuracy:  {acc_h:.4f}  ({acc_h*100:.2f}%)")
print(f"   Precision: {prec_h:.4f}")
print(f"   Recall:    {rec_h:.4f}")
print(f"   F1-Score:  {f1_h:.4f}")
print()
print("   Confusion Matrix (Rows=Actual, Cols=Predicted):")
print("             Predicted-Benign  Predicted-Malicious")
print(f"   Actual-Benign:     {cm_h[0][0]:>5}              {cm_h[0][1]:>5}")
print(f"   Actual-Malicious:  {cm_h[1][0]:>5}              {cm_h[1][1]:>5}")
print()

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 2: Heuristic Tactic Classifier on threat_classification.csv
# ─────────────────────────────────────────────────────────────────────────────
print("▶  [2/4] HEURISTIC ENGINE — Multi-Class Tactic Classifier")
print("   Dataset: threat_classification.csv  (1,670 samples)")
print("-" * 70)

tactic_df = pd.read_csv("data/training_data/threat_classification.csv").dropna()
tactic_df = tactic_df[tactic_df["threat_category"].isin(TACTIC_LABELS)]

true_tactic = []
pred_tactic = []

for _, row in tactic_df.iterrows():
    text  = str(row["text"])
    label = str(row["threat_category"])
    true_tactic.append(label)

    # Run heuristic and map highest-confidence category to tactic
    best_cat  = None
    best_conf = 0.0
    for cat_name, sig in THREAT_SIGNATURES.items():
        conf = calculate_confidence(text, sig["keywords"])
        if conf > best_conf:
            best_conf = conf
            best_cat  = cat_name

    if best_cat and best_conf > 0.0 and best_cat in CATEGORY_TO_TACTIC:
        pred_tactic.append(CATEGORY_TO_TACTIC[best_cat])
    else:
        pred_tactic.append("Unknown")

# Align labels
all_labels = sorted(set(true_tactic + [p for p in pred_tactic if p != "Unknown"]))

acc_t  = accuracy_score(true_tactic, pred_tactic)
prec_t = precision_score(true_tactic, pred_tactic, labels=TACTIC_LABELS, average="weighted", zero_division=0)
rec_t  = recall_score(true_tactic, pred_tactic, labels=TACTIC_LABELS, average="weighted", zero_division=0)
f1_t   = f1_score(true_tactic, pred_tactic, labels=TACTIC_LABELS, average="weighted", zero_division=0)

print(f"   Accuracy:           {acc_t:.4f}  ({acc_t*100:.2f}%)")
print(f"   Precision (wtd):    {prec_t:.4f}")
print(f"   Recall (wtd):       {rec_t:.4f}")
print(f"   F1-Score (wtd):     {f1_t:.4f}")
print()
print("   Per-class breakdown:")
report_lines = classification_report(
    true_tactic, pred_tactic, labels=TACTIC_LABELS, zero_division=0
).split("\n")
for line in report_lines:
    print(f"   {line}")
print()

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 3: SecBERT Tactic Classifier
# ─────────────────────────────────────────────────────────────────────────────
print("▶  [3/4] SecBERT CLASSIFIER — Multi-Class Tactic Mapper")
print("   Dataset: threat_classification.csv  (random 300-sample eval)")
print("-" * 70)

from core.secbert_classifier import secbert_clf

SECBERT_TACTIC_MAP = {
    "T1055": "Defense Evasion",
    "T1027": "Defense Evasion",
    "T1059": "Execution",
    "T1059.001": "Execution",
    "T1053": "Persistence",
    "T1547": "Persistence",
    "T1547.001": "Persistence",
    "T1003": "Credential Access",
    "T1110": "Credential Access",
    "T1558": "Credential Access",
    "T1555": "Credential Access",
    "T1021": "Lateral Movement",
    "T1080": "Lateral Movement",
    "T1046": "Discovery",
    "T1082": "Discovery",
    "T1087.002": "Discovery",
    "T1069.002": "Discovery",
    "T1033": "Discovery",
    "T1016": "Discovery",
    "T1048": "Exfiltration",
    "T1041": "Exfiltration",
    "T1005": "Collection",
    "T1560": "Collection",
    "T1071": "Command And Control",
    "T1095": "Command And Control",
    "T1486": "Impact",
    "T1485": "Impact",
    "T1489": "Impact",
    "T1190": "Initial Access",
    "T1566": "Initial Access",
    "T1548": "Privilege Escalation",
    "T1134": "Privilege Escalation",
    "T1068": "Privilege Escalation",
}

loaded = secbert_clf.load()
secbert_preds = []
secbert_trues = []

if loaded:
    sample_df = tactic_df.sample(n=min(300, len(tactic_df)), random_state=99)
    t0 = time.time()

    for _, row in sample_df.iterrows():
        text  = str(row["text"])
        label = str(row["threat_category"])
        secbert_trues.append(label)

        techs = secbert_clf.predict_techniques(text)
        if techs:
            top_tech = max(techs, key=techs.get)
            mapped = SECBERT_TACTIC_MAP.get(top_tech, "Unknown")
        else:
            mapped = "Unknown"
        secbert_preds.append(mapped)

    elapsed = time.time() - t0
    print(f"   Inference time: {elapsed:.2f}s for {len(sample_df)} samples  ({elapsed/len(sample_df)*1000:.1f}ms/sample)")
    print()

    acc_s  = accuracy_score(secbert_trues, secbert_preds)
    prec_s = precision_score(secbert_trues, secbert_preds, labels=TACTIC_LABELS, average="weighted", zero_division=0)
    rec_s  = recall_score(secbert_trues, secbert_preds, labels=TACTIC_LABELS, average="weighted", zero_division=0)
    f1_s   = f1_score(secbert_trues, secbert_preds, labels=TACTIC_LABELS, average="weighted", zero_division=0)

    print(f"   Accuracy:           {acc_s:.4f}  ({acc_s*100:.2f}%)")
    print(f"   Precision (wtd):    {prec_s:.4f}")
    print(f"   Recall (wtd):       {rec_s:.4f}")
    print(f"   F1-Score (wtd):     {f1_s:.4f}")
    print()
    print("   Per-class breakdown:")
    report_s = classification_report(secbert_trues, secbert_preds, labels=TACTIC_LABELS, zero_division=0).split("\n")
    for line in report_s:
        print(f"   {line}")
else:
    print("   ⚠  SecBERT model not found — skipping (train with scripts/train_secbert.py)")
    acc_s = prec_s = rec_s = f1_s = None
print()

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 4: Semantic Embedder — Technique Retrieval Hit-Rate
# ─────────────────────────────────────────────────────────────────────────────
print("▶  [4/4] SEMANTIC EMBEDDER — Technique Retrieval Hit-Rate")
print("   Tests whether the correct MITRE Technique appears in the Top-5 results")
print("-" * 70)

import time
from core import technique_embedder

# Build a small ground-truth set: clear single-technique snippets
GROUND_TRUTH = [
    ("The attacker used mimikatz to dump LSASS credentials.",        "T1003"),
    ("Ransomware encrypted all files and demands bitcoin payment.",   "T1486"),
    ("C2 beacon communicating over port 443 to external IP.",        "T1071"),
    ("PowerShell one-liner downloads and executes payload.",         "T1059"),
    ("SQL injection via UNION SELECT extracted the users table.",    "T1190"),
    ("Scheduled task created in Windows for persistence.",           "T1053"),
    ("Data exfiltrated over DNS tunneling to C2 server.",            "T1048"),
    ("WMI used for lateral movement to remote workstation.",         "T1047"),
    ("Port scan detected across 254 hosts in subnet.",               "T1046"),
    ("Registry run key added for boot persistence.",                 "T1547"),
    ("Kerberoasting attack extracted Kerberos service tickets.",      "T1558"),
    ("Pass-the-hash attack used NTLM hash to authenticate.",         "T1550"),
    ("Spear-phishing email with malicious document attachment.",     "T1566"),
    ("UAC bypass using fodhelper.exe for privilege escalation.",     "T1548"),
    ("Process injection into svchost.exe to evade detection.",       "T1055"),
    ("Web shell uploaded to Apache server for persistent access.",   "T1505"),
    ("Adversary collected files from Desktop and Documents folders.", "T1005"),
    ("Brute force attack on SSH with 10,000 login attempts.",        "T1110"),
    ("RDP used with stolen credentials to access remote server.",    "T1021"),
    ("Malware dropped loader in %TEMP% and added autorun entry.",    "T1543"),
]

print(f"   Ground-truth samples: {len(GROUND_TRUTH)}")

# Ensure embeddings are loaded
technique_embedder.precompute_technique_embeddings()

if not technique_embedder.is_embedder_ready():
    print("   ⚠  Sentence-transformer model not loaded — skipping.")
else:
    hit_at_1 = 0
    hit_at_3 = 0
    hit_at_5 = 0

    # Load full attack DB to rank all techniques
    attack_db = technique_embedder._load_attack_db()
    all_ids = [t["id"] for t in attack_db]

    for text, correct_id in GROUND_TRUTH:
        scores = technique_embedder.batch_score_techniques(text, all_ids)
        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        top_ids = [r[0] for r in ranked[:5]]

        if correct_id == top_ids[0]:
            hit_at_1 += 1
        if correct_id in top_ids[:3]:
            hit_at_3 += 1
        if correct_id in top_ids[:5]:
            hit_at_5 += 1

    n = len(GROUND_TRUTH)
    hit1 = hit_at_1 / n
    hit3 = hit_at_3 / n
    hit5 = hit_at_5 / n

    print(f"   Hit@1 (exact top match):   {hit1:.4f}  ({hit_at_1}/{n})")
    print(f"   Hit@3 (within top 3):      {hit3:.4f}  ({hit_at_3}/{n})")
    print(f"   Hit@5 (within top 5):      {hit5:.4f}  ({hit_at_5}/{n})")
    print()

    # Per-sample breakdown
    print("   Per-sample results:")
    print(f"   {'Text snippet':<52} {'Expected':<10} {'Top-1 Got':<10} {'✓/✗'}")
    print("   " + "-" * 78)
    for text, correct_id in GROUND_TRUTH:
        scores = technique_embedder.batch_score_techniques(text, all_ids)
        top1 = max(scores, key=scores.get)
        ok = "✓" if top1 == correct_id else f"✗ (got {top1})"
        snippet = text[:50].replace("\n", " ")
        print(f"   {snippet:<52} {correct_id:<10} {top1:<10} {ok}")

print()

# ─────────────────────────────────────────────────────────────────────────────
# FINAL SUMMARY TABLE
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 70)
print("  FINAL SUMMARY")
print("=" * 70)
print(f"  {'Model':<42} {'Acc':>7} {'Prec':>7} {'Rec':>7} {'F1':>7}")
print(f"  {'-'*42} {'-'*7} {'-'*7} {'-'*7} {'-'*7}")
print(f"  {'Heuristic (Binary: Benign/Malicious)':<42} {acc_h:>7.4f} {prec_h:>7.4f} {rec_h:>7.4f} {f1_h:>7.4f}")
print(f"  {'Heuristic (Tactic: 14-class)':<42} {acc_t:>7.4f} {prec_t:>7.4f} {rec_t:>7.4f} {f1_t:>7.4f}")
if acc_s is not None:
    print(f"  {'SecBERT (Tactic: 14-class)':<42} {acc_s:>7.4f} {prec_s:>7.4f} {rec_s:>7.4f} {f1_s:>7.4f}")
else:
    print(f"  {'SecBERT (Tactic: 14-class)':<42} {'N/A':>7} {'N/A':>7} {'N/A':>7} {'N/A':>7}")
if technique_embedder.is_embedder_ready():
    print(f"  {'Semantic Embedder (Hit@5 as Recall)':<42} {'N/A':>7} {'N/A':>7} {hit5:>7.4f} {'N/A':>7}")
print("=" * 70)
print()
print("  Evaluation complete.")
