# autoMITRE v1.2 — AI-Driven Cyber Threat Intelligence Platform

> Autonomous threat detection and MITRE ATT&CK mapping powered by a 3-stage AI pipeline:
> **SecBERT (fine-tuned transformer)** → **Groq Cloud LLM (Llama-3)** → **Semantic Embeddings (MPNet)**

---

## What It Does

- **Threat Analysis** — Paste any threat description, log, or indicator and get full MITRE ATT&CK technique mapping with confidence scores
- **Multi-Framework Mapping** — Simultaneous mapping to ATT&CK, D3FEND, NIST SP 800-53, and OWASP Top 10
- **PCAP Analysis** — Upload packet captures for network-level threat detection
- **Malware Hash Lookup** — VirusTotal integration for hash reputation checking
- **Threat Intelligence Feed** — Live OSINT from Abuse.ch, AlienVault OTX, and MISP
- **PDF Export** — Generate professional threat reports
- **Team Workspaces** — RBAC with private/SOC Team/shared modes
- **AI Risk Chat** — Ask questions about detected threats

---

## Quick Start

### Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| **Python** | 3.11+ | https://python.org |
| **Node.js** | 18+ | https://nodejs.org |
| **Git LFS** | Any | https://git-lfs.github.com |

> **macOS:** `brew install python node git-lfs`  
> **Ubuntu/Debian:** `apt install python3 nodejs npm git-lfs`  
> **Windows:** Use WSL2 with Ubuntu, then the Linux commands above.

### 1 — Clone the repository

```bash
git clone https://github.com/moustafa-elshenawy/autoMITRE1.2.git
cd autoMITRE1.2

# Initialize Git LFS (downloads the large AI model files)
git lfs install
git lfs pull
```

### 2 — Run the setup wizard

```bash
chmod +x setup.sh
./setup.sh
```

The script handles everything automatically:
- Creates `backend/.env` from the example
- Creates a Python virtual environment
- Installs all Python packages (~5–10 min on first run)
- Downloads NLP models (spaCy, NLTK, sentence-transformers)
- Installs frontend packages
- Initializes the database and creates an admin account

### 3 — Configure your API keys

Open `backend/.env` and add your keys:

```env
# REQUIRED — Powers the AI analysis engine
GROQ_API_KEY=gsk_...

# Optional — Enables malware hash lookups
VIRUSTOTAL_API_KEY=...

# Optional — Adds AlienVault threat intelligence
OTX_API_KEY=...
```

See [API Keys Setup](#api-keys-setup) below for where to get each key.

### 4 — Start the application

```bash
./run.sh
```

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:5173 |
| **Backend API** | http://localhost:8000 |
| **API Docs** | http://localhost:8000/docs |

**Default login:**
```
Username: admin
Password: Admin@1234!
```
> ⚠️ Change the default password after first login (Settings → Profile).

---

## API Keys Setup

### 🔑 Groq API Key (REQUIRED)

Powers the AI reasoning engine — gives you significantly more accurate and comprehensive technique mapping.

1. Go to **https://console.groq.com**
2. Sign up for a free account (no credit card required)
3. Click **API Keys** in the left sidebar → **Create API Key**
4. Copy the key (starts with `gsk_`) into `backend/.env`:
   ```
   GROQ_API_KEY=gsk_your_key_here
   ```
**Free tier:** 6,000 tokens/min, 500,000 tokens/day — more than enough for personal/team use.

---

### 🔑 VirusTotal API Key (optional)

Enables malware hash lookups via the **Hash Analysis** tab.

1. Go to **https://www.virustotal.com**
2. Create a free account
3. Go to **Profile → API Key**
4. Copy the key into `backend/.env`:
   ```
   VIRUSTOTAL_API_KEY=your_key_here
   ```

---

### 🔑 AlienVault OTX API Key (optional)

Adds AlienVault threat intelligence to the live feed.

1. Go to **https://otx.alienvault.com**
2. Create a free account
3. Go to **Settings → API Integration**
4. Copy the key into `backend/.env`:
   ```
   OTX_API_KEY=your_key_here
   ```

---

## Project Structure

```
autoMITRE1.2/
├── setup.sh                  ← First-run setup script (run this!)
├── run.sh                    ← Start both services
├── backend/
│   ├── .env.example          ← Copy to .env and fill in your keys
│   ├── requirements.txt      ← All Python dependencies
│   ├── main.py               ← FastAPI entry point
│   ├── core/
│   │   ├── ai_threat_analyzer.py    ← Main analysis pipeline
│   │   ├── secbert_classifier.py    ← Stage 1: SecBERT ML model
│   │   ├── nano_llm_engine.py       ← Stage 2: Groq/Phi-3.5 LLM
│   │   ├── technique_embedder.py    ← Stage 3: MPNet semantic scoring
│   │   ├── framework_mapper.py      ← D3FEND / NIST / OWASP mapping
│   │   ├── osint_client.py          ← Threat intelligence feeds
│   │   └── pcap_extractor.py        ← PCAP network analysis
│   ├── models/
│   │   ├── secbert_tram/            ← Fine-tuned SecBERT (Git LFS, 320MB)
│   │   ├── severity_model.pkl       ← ML severity classifier
│   │   └── severity_regression_model.pkl  ← CVSS regression model
│   ├── data/
│   │   ├── mitre_attack.json        ← Full MITRE ATT&CK database
│   │   ├── mitre_defend.json        ← MITRE D3FEND database
│   │   ├── nist_controls.json       ← NIST SP 800-53 controls
│   │   └── owasp_data.json          ← OWASP Top 10 data
│   └── scripts/
│       ├── train_secbert.py         ← Retrain SecBERT model
│       └── train_severity_model.py  ← Retrain severity models
└── frontend/
    ├── package.json             ← Node.js dependencies
    └── src/
        ├── pages/               ← React page components
        └── components/          ← Reusable UI components
```

---

## How the AI Pipeline Works

Every threat analysis runs through 3 stages in sequence:

```
Input Text
    │
    ▼
┌─────────────────────────────────────────┐
│  Stage 1: SecBERT TRAM Classifier       │
│  Fine-tuned transformer (320MB, local)  │
│  → Predicts top-5 ATT&CK technique IDs  │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Stage 2: Heuristic Keyword Matching    │
│  15+ threat categories with pattern    │
│  matching and confidence decay          │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Stage 3: MPNet Semantic Scoring        │
│  all-mpnet-base-v2 (420MB, HuggingFace) │
│  → Real cosine similarity per technique │
└───────────────────┬─────────────────────┘
                    │
                    ▼
         Ranked ATT&CK Techniques
         (confidence-filtered, deduped)
```

**Groq LLM** (Llama-3 via cloud) is used for:
- File/log attack extraction (`extract-attacks` endpoint)
- Importing external threat models (IriusRisk, Threat Dragon)

---

## Manual Setup (if setup.sh doesn't work)

```bash
# 1. Backend virtual environment
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# 2. Install Python packages
pip install -r requirements.txt

# 3. Download spaCy language model
python -m spacy download en_core_web_sm

# 4. Download NLTK data
python -c "import nltk; [nltk.download(p) for p in ['punkt','stopwords','wordnet']]"

# 5. Pre-cache sentence-transformers model (~420MB, one-time)
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-mpnet-base-v2')"

# 6. Configure environment
cp .env.example .env
# → Edit .env and add your GROQ_API_KEY

# 7. Frontend
cd ../frontend
npm install

# 8. Pull LFS model files
cd ..
git lfs pull

# 9. Start
./run.sh
```

---

## Large Files (Git LFS)

These files are stored in Git LFS and are downloaded via `git lfs pull`:

| File | Size | Purpose |
|------|------|---------|
| `backend/models/secbert_tram/model.safetensors` | 320 MB | Fine-tuned SecBERT classifier |
| `backend/data/raw/enterprise_attack.json` | ~50 MB | Full MITRE ATT&CK enterprise data |

The following files are **NOT in git** (they are auto-downloaded or created locally):

| File | Size | How it's obtained |
|------|------|------------------|
| `~/.cache/huggingface/all-mpnet-base-v2` | 420 MB | Auto-downloaded by sentence-transformers |
| `backend/models/Phi-3.5-mini-instruct-Q4_K_M.gguf` | 2.2 GB | Optional — local LLM fallback if no Groq key |
| `backend/automitre.db` | Auto-created | SQLite database, created on first run |
| `backend/.env` | — | You create this from `.env.example` |

---

## Troubleshooting

### "SecBERT model directory not found"
The Git LFS files weren't downloaded. Run:
```bash
git lfs install
git lfs pull
```

### "Could not load sentence-transformer model"
The MPNet model wasn't cached. Run:
```bash
cd backend
./venv/bin/python3 -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-mpnet-base-v2')"
```

### "GROQ_API_KEY is not set"
Create `backend/.env` from the example and add your key:
```bash
cp backend/.env.example backend/.env
# Edit backend/.env and set GROQ_API_KEY=gsk_...
```

### "Failed to load ATT&CK databases"
The JSON data files should be in `backend/data/`. If missing, re-clone the repo — these files are committed to git (not LFS).

### Port already in use
Kill existing processes:
```bash
kill $(cat backend/uvicorn.pid) 2>/dev/null
kill $(cat frontend/frontend.pid) 2>/dev/null
./run.sh
```

### Database schema errors
Delete the database and let it rebuild:
```bash
rm backend/automitre.db
./run.sh
```

---

## System Requirements Summary

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 4 cores | 8+ cores |
| RAM | 8 GB | 16 GB |
| Disk | 5 GB free | 10 GB free |
| OS | macOS 12 / Ubuntu 20 / Windows WSL2 | macOS 14+ / Ubuntu 22+ |
| Python | 3.11 | 3.13 |
| Node.js | 18 | 20+ |

> **Apple Silicon (M1/M2/M3):** Fully supported. PyTorch uses Metal Performance Shaders (MPS) automatically for GPU acceleration.

---

## License

This project was developed as part of an academic research thesis on AI-Driven Cyber Threat Intelligence.
