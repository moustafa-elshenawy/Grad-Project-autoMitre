#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# autoMITRE v1.2 — First-Run Setup Script
#
# Run this ONCE after cloning the repository:
#   chmod +x setup.sh && ./setup.sh
#
# What this script does:
#   1. Checks system requirements (Python 3.13+, Node 18+, Git LFS)
#   2. Creates backend/.env from .env.example if it doesn't exist
#   3. Creates the Python virtual environment
#   4. Installs all Python dependencies
#   5. Downloads the spaCy NLP language model
#   6. Installs frontend Node.js dependencies
#   7. Pulls large model files from Git LFS
#   8. Creates the first admin user in the database
# ─────────────────────────────────────────────────────────────────────────────

set -e  # Exit on any error

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ── Helpers ───────────────────────────────────────────────────────────────────
ok()   { echo -e "${GREEN}  ✓ $1${NC}"; }
info() { echo -e "${BLUE}  → $1${NC}"; }
warn() { echo -e "${YELLOW}  ⚠ $1${NC}"; }
fail() { echo -e "${RED}  ✗ $1${NC}"; exit 1; }
step() { echo -e "\n${BOLD}${CYAN}━━ $1 ━━${NC}"; }

# ── Navigate to repo root ─────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║     autoMITRE v1.2 — Setup Wizard       ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Check system requirements
# ─────────────────────────────────────────────────────────────────────────────
step "1/7  Checking system requirements"

# Python 3.13+
if command -v python3 &>/dev/null; then
    PY_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    PY_MAJOR=$(echo "$PY_VERSION" | cut -d. -f1)
    PY_MINOR=$(echo "$PY_VERSION" | cut -d. -f2)
    if [ "$PY_MAJOR" -ge 3 ] && [ "$PY_MINOR" -ge 11 ]; then
        ok "Python $PY_VERSION"
    else
        fail "Python 3.11+ required (found $PY_VERSION). Download from https://python.org"
    fi
else
    fail "Python 3 not found. Download from https://python.org"
fi

# Node.js 18+
if command -v node &>/dev/null; then
    NODE_VERSION=$(node --version | sed 's/v//')
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
        ok "Node.js v$NODE_VERSION"
    else
        fail "Node.js 18+ required (found $NODE_VERSION). Download from https://nodejs.org"
    fi
else
    fail "Node.js not found. Download from https://nodejs.org"
fi

# npm
if command -v npm &>/dev/null; then
    ok "npm $(npm --version)"
else
    fail "npm not found. Install Node.js from https://nodejs.org"
fi

# Git LFS
if command -v git-lfs &>/dev/null; then
    ok "Git LFS $(git lfs version | awk '{print $1}')"
else
    warn "Git LFS not found — large model files may not download correctly."
    warn "Install: https://git-lfs.github.com  (or: brew install git-lfs)"
    echo ""
    read -p "  Continue anyway? [y/N] " -n 1 -r REPLY
    echo ""
    [[ $REPLY =~ ^[Yy]$ ]] || exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Configure environment variables
# ─────────────────────────────────────────────────────────────────────────────
step "2/7  Environment configuration"

ENV_FILE="$REPO_ROOT/backend/.env"
ENV_EXAMPLE="$REPO_ROOT/backend/.env.example"

if [ -f "$ENV_FILE" ]; then
    ok ".env already exists — skipping creation"
else
    if [ -f "$ENV_EXAMPLE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        ok "Created backend/.env from .env.example"
    else
        fail ".env.example not found. Please re-clone the repository."
    fi

    echo ""
    echo -e "${YELLOW}  ┌─────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${YELLOW}  │  ACTION REQUIRED: Configure your API keys                   │${NC}"
    echo -e "${YELLOW}  │                                                             │${NC}"
    echo -e "${YELLOW}  │  Open backend/.env and set at minimum:                      │${NC}"
    echo -e "${YELLOW}  │                                                             │${NC}"
    echo -e "${YELLOW}  │  GROQ_API_KEY=...  (free at https://console.groq.com)       │${NC}"
    echo -e "${YELLOW}  │                                                             │${NC}"
    echo -e "${YELLOW}  │  Optional (enhances threat intelligence):                   │${NC}"
    echo -e "${YELLOW}  │  VIRUSTOTAL_API_KEY=...  (free at virustotal.com)           │${NC}"
    echo -e "${YELLOW}  │  OTX_API_KEY=...         (free at otx.alienvault.com)       │${NC}"
    echo -e "${YELLOW}  └─────────────────────────────────────────────────────────────┘${NC}"
    echo ""

    read -p "  Open backend/.env now to set GROQ_API_KEY? [Y/n] " -n 1 -r REPLY
    echo ""
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        if command -v code &>/dev/null; then
            code "$ENV_FILE"
        elif command -v nano &>/dev/null; then
            nano "$ENV_FILE"
        else
            open "$ENV_FILE" 2>/dev/null || echo "  → Manually edit: backend/.env"
        fi
        read -p "  Press Enter when done editing .env..."
    fi
fi

# Warn if GROQ_API_KEY is still the placeholder
if grep -q "your-groq-api-key-here" "$ENV_FILE" 2>/dev/null; then
    warn "GROQ_API_KEY is not set in backend/.env"
    warn "The AI analysis engine will use fallback mode (heuristics only)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Python virtual environment
# ─────────────────────────────────────────────────────────────────────────────
step "3/7  Python virtual environment"

VENV_DIR="$REPO_ROOT/backend/venv"

if [ -d "$VENV_DIR" ]; then
    ok "Virtual environment already exists"
else
    info "Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
    ok "Virtual environment created at backend/venv/"
fi

PYTHON="$VENV_DIR/bin/python3"
PIP="$VENV_DIR/bin/pip"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Install Python dependencies
# ─────────────────────────────────────────────────────────────────────────────
step "4/7  Installing Python dependencies"
info "This may take 5–10 minutes on first run (downloading ML libraries)..."
echo ""

$PIP install --upgrade pip --quiet
$PIP install -r "$REPO_ROOT/backend/requirements.txt" --quiet \
    && ok "All Python packages installed" \
    || fail "pip install failed. Check backend/requirements.txt and try again."

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — Download NLP models
# ─────────────────────────────────────────────────────────────────────────────
step "5/7  Downloading NLP language models"

# spaCy English model (en_core_web_sm ~12MB)
if $PYTHON -c "import spacy; spacy.load('en_core_web_sm')" 2>/dev/null; then
    ok "spaCy en_core_web_sm already installed"
else
    info "Downloading spaCy English model (en_core_web_sm ~12 MB)..."
    $PYTHON -m spacy download en_core_web_sm --quiet \
        && ok "spaCy en_core_web_sm downloaded" \
        || warn "spaCy model download failed — NER extraction will be limited"
fi

# NLTK data
info "Downloading NLTK corpora..."
$PYTHON -c "
import nltk, warnings
warnings.filterwarnings('ignore')
for pkg in ['punkt', 'stopwords', 'wordnet']:
    try:
        nltk.download(pkg, quiet=True)
    except:
        pass
print('NLTK data ready')
" && ok "NLTK data ready"

# sentence-transformers all-mpnet-base-v2 (~420MB) — cached by HuggingFace automatically
info "Pre-warming sentence-transformers model (all-mpnet-base-v2 ~420 MB)..."
info "This downloads once and is cached at ~/.cache/huggingface/"
$PYTHON -c "
from sentence_transformers import SentenceTransformer
print('Downloading all-mpnet-base-v2...')
m = SentenceTransformer('all-mpnet-base-v2')
print('sentence-transformers model ready')
" && ok "sentence-transformers model cached" \
  || warn "sentence-transformers download failed — semantic scoring will use fallback"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 6 — Frontend dependencies
# ─────────────────────────────────────────────────────────────────────────────
step "6/7  Installing frontend dependencies"

cd "$REPO_ROOT/frontend"
if [ -d "node_modules" ]; then
    ok "node_modules already exists"
else
    info "Running npm install..."
    npm install --silent && ok "Frontend packages installed"
fi
cd "$REPO_ROOT"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 7 — Git LFS model files
# ─────────────────────────────────────────────────────────────────────────────
step "7/7  Pulling large model files (Git LFS)"

SECBERT_MODEL="$REPO_ROOT/backend/models/secbert_tram/model.safetensors"

if [ -f "$SECBERT_MODEL" ] && [ "$(wc -c < "$SECBERT_MODEL")" -gt 10000 ]; then
    ok "SecBERT model already present ($(du -sh "$SECBERT_MODEL" | cut -f1))"
else
    if command -v git-lfs &>/dev/null; then
        info "Pulling large model files via Git LFS (~400 MB)..."
        git lfs pull \
            && ok "Git LFS files downloaded" \
            || warn "Git LFS pull failed — SecBERT classifier will be disabled"
    else
        warn "Git LFS not installed — SecBERT model not downloaded"
        warn "Without the SecBERT model, the app uses heuristic matching only"
        warn "Install git-lfs and run: git lfs pull"
    fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Create initial admin user
# ─────────────────────────────────────────────────────────────────────────────
step "Creating initial admin account"

info "Starting a temporary backend instance to initialize the database..."

cd "$REPO_ROOT/backend"

# Start backend briefly to create tables
$PYTHON -c "
import asyncio, sys, os
sys.path.insert(0, '.')
os.chdir('.')

async def init():
    from database.config import engine, Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('Database tables created successfully')

asyncio.run(init())
" && ok "Database schema initialized"

# Create default admin user
$PYTHON -c "
import asyncio, sys, os
sys.path.insert(0, '.')

async def create_admin():
    from database.config import SessionLocal
    from database.models import User
    from models.auth import get_password_hash
    import uuid

    async with SessionLocal() as db:
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.username == 'admin'))
        existing = result.scalar_one_or_none()
        if existing:
            print('Admin user already exists')
            return
        user = User(
            id=str(uuid.uuid4()),
            username='admin',
            email='admin@automitre.local',
            hashed_password=get_password_hash('Admin@1234!'),
            role='admin',
            is_active=True
        )
        db.add(user)
        await db.commit()
        print('Admin user created: username=admin  password=Admin@1234!')

asyncio.run(create_admin())
" 2>/dev/null && ok "Default admin user ready" || warn "Could not create admin user (may already exist)"

cd "$REPO_ROOT"

# ─────────────────────────────────────────────────────────────────────────────
# Done!
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║                  Setup Complete! 🎉                          ║${NC}"
echo -e "${BOLD}${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}${GREEN}║                                                              ║${NC}"
echo -e "${BOLD}${GREEN}║  Start the application:    ./run.sh                          ║${NC}"
echo -e "${BOLD}${GREEN}║                                                              ║${NC}"
echo -e "${BOLD}${GREEN}║  Frontend:   http://localhost:5173                           ║${NC}"
echo -e "${BOLD}${GREEN}║  Backend:    http://localhost:8000                           ║${NC}"
echo -e "${BOLD}${GREEN}║  API Docs:   http://localhost:8000/docs                      ║${NC}"
echo -e "${BOLD}${GREEN}║                                                              ║${NC}"
echo -e "${BOLD}${GREEN}║  Default credentials:                                        ║${NC}"
echo -e "${BOLD}${GREEN}║    Username: admin                                           ║${NC}"
echo -e "${BOLD}${GREEN}║    Password: Admin@1234!                                     ║${NC}"
echo -e "${BOLD}${GREEN}║                                                              ║${NC}"
echo -e "${BOLD}${GREEN}║  ⚠ Change the default password after first login!            ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
