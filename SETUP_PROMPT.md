I just cloned a project called **autoMITRE v1.2** — an AI-driven cyber threat intelligence platform. I need you to help me get it fully running on my machine so it works exactly like the original developer's version. Here's everything you need to know:

---

## Repository
GitHub: https://github.com/moustafa-elshenawy/autoMITRE1.2

## Tech Stack
- **Backend:** Python 3.13, FastAPI, SQLite (via SQLAlchemy + aiosqlite)
- **Frontend:** React 18 + Vite (Node.js)
- **AI/ML:** PyTorch, HuggingFace Transformers, sentence-transformers, spaCy, XGBoost
- **LLM:** Groq Cloud API (Llama-3), with local Phi-3.5 as fallback
- **Large files:** Git LFS (SecBERT model ~320MB)

---

## Step 1 — Prerequisites to check and install

Please check if I have the following installed, and if not, install them or tell me exactly how:

1. **Python 3.11 or newer** — check with `python3 --version`
2. **Node.js 18 or newer** — check with `node --version`
3. **npm** — check with `npm --version`
4. **Git LFS** — check with `git lfs version`
   - macOS: `brew install git-lfs`
   - Ubuntu/Debian: `sudo apt install git-lfs`
   - Windows: download from https://git-lfs.github.com

---

## Step 2 — Clone and pull all files (including large models)

```bash
git clone https://github.com/moustafa-elshenawy/autoMITRE1.2.git
cd autoMITRE1.2
git lfs install
git lfs pull
```

The `git lfs pull` step downloads the **320MB SecBERT AI model** (`backend/models/secbert_tram/model.safetensors`). Without it, the AI classifier won't work. Verify the file is real (not a pointer) by checking its size is ~320MB.

---

## Step 3 — Python virtual environment + dependencies

```bash
cd backend
python3 -m venv venv

# Activate the venv:
source venv/bin/activate          # macOS / Linux
# venv\Scripts\activate           # Windows

pip install --upgrade pip
pip install -r requirements.txt
```

This installs ~100 packages including PyTorch, Transformers, sentence-transformers, FastAPI, spaCy, XGBoost, and more. It may take 5–10 minutes.

---

## Step 4 — Download NLP models (one-time)

Run these inside the activated venv:

```bash
# spaCy English NER model (~12MB)
python -m spacy download en_core_web_sm

# NLTK data
python -c "import nltk; [nltk.download(p, quiet=True) for p in ['punkt','stopwords','wordnet']]"

# sentence-transformers semantic model (~420MB, cached by HuggingFace)
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-mpnet-base-v2'); print('Done')"
```

The last command downloads `all-mpnet-base-v2` to `~/.cache/huggingface/`. It only downloads once.

---

## Step 5 — Frontend dependencies

```bash
cd ../frontend
npm install
cd ..
```

---

## Step 6 — Configure environment variables (API KEYS)

```bash
cp backend/.env.example backend/.env
```

Now open `backend/.env` and fill in the keys below.

### 🔑 REQUIRED: Groq API Key
This powers the AI reasoning engine. Without it, the app only uses basic keyword matching and will detect fewer techniques.

**Get it free in 60 seconds:**
1. Go to https://console.groq.com
2. Sign up / log in (free, no credit card needed)
3. Click **API Keys** → **Create API Key**
4. Copy the key (starts with `gsk_`)

Set it in `backend/.env`:
```
GROQ_API_KEY=gsk_your_key_here
```

### 🔑 OPTIONAL: VirusTotal API Key
Enables malware hash lookups in the Hash Analysis tab.
1. Go to https://www.virustotal.com → sign up free
2. Go to **Profile → API Key**
3. Set in `.env`: `VIRUSTOTAL_API_KEY=your_key_here`

### 🔑 OPTIONAL: AlienVault OTX API Key
Adds live threat intelligence to the feed.
1. Go to https://otx.alienvault.com → sign up free
2. Go to **Settings → API Integration**
3. Set in `.env`: `OTX_API_KEY=your_key_here`

The final `backend/.env` should look like this:
```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
VIRUSTOTAL_API_KEY=                    # leave blank if you don't have it
OTX_API_KEY=                           # leave blank if you don't have it
FRAMEWORK_ATTACK=true
FRAMEWORK_DEFEND=true
FRAMEWORK_NIST=true
FRAMEWORK_OWASP=true
OSINT_CACHE_TTL=300
OSINT_LIMIT=50
OSINT_MIN_SEVERITY=Low
OSINT_STORE_LOCALLY=true
```

---

## Step 7 — Start the application

From the project root:

```bash
chmod +x run.sh
./run.sh
```

This starts:
- **Backend** on http://localhost:8000
- **Frontend** on http://localhost:5173
- **API Docs** on http://localhost:8000/docs

**Default login credentials:**
```
Username: admin
Password: Admin@1234!
```

---

## Step 8 — Verify everything is working

After the app starts, please check these things for me:

1. Open http://localhost:5173 — you should see the autoMITRE login page
2. Log in with `admin` / `Admin@1234!`
3. Go to **Threat Analysis**
4. Click **Load Example** then **Analyze Threat**
5. You should see **ATT&CK techniques** appear (ideally 10+ results) — if you see fewer than 5, the Groq API key may not be set correctly

---

## Troubleshooting

If something goes wrong, here are the most common issues:

| Problem | Fix |
|---------|-----|
| `git lfs pull` downloads a tiny text file instead of the model | Run `git lfs install` first, then `git lfs pull` again |
| `No module named 'torch'` | Make sure you activated the venv with `source venv/bin/activate` before running pip |
| Backend starts but frontend shows "Network Error" | The backend may still be loading (wait 10 seconds and refresh) |
| Only 3–5 ATT&CK techniques detected | Your `GROQ_API_KEY` in `backend/.env` is missing or incorrect |
| `Database error: no such column` | Delete `backend/automitre.db` and restart — it rebuilds automatically |
| Port 8000 already in use | Run `kill $(lsof -ti:8000)` then start again |
| `model.safetensors` is only 134 bytes | Git LFS didn't download properly — run `git lfs pull` |

---

## What files are NOT in the repository (gitignored)

These files exist on the original developer's machine but are NOT pushed to GitHub. You either don't need them or need to create them yourself:

| File | Status | Action |
|------|--------|--------|
| `backend/.env` | Gitignored (security) | ✅ You create this from `.env.example` in Step 6 |
| `backend/automitre.db` | Gitignored (runtime DB) | ✅ Auto-created on first startup |
| `~/.cache/huggingface/all-mpnet-base-v2` | Too large, auto-cached | ✅ Downloaded in Step 4 |
| `backend/models/Phi-3.5-mini-instruct-Q4_K_M.gguf` | 2.2GB, gitignored | ⚪ Optional — only needed if you have no Groq key |
| `backend/venv/` | Gitignored (local) | ✅ You create this in Step 3 |
| `frontend/node_modules/` | Gitignored (local) | ✅ You create this in Step 5 |

---

Please run through each step in order, show me the output of each command, and let me know if anything fails so you can help me fix it.
