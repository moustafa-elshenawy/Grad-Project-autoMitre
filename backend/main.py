"""
autoMITRE — Main FastAPI Application
Autonomous AI-Driven Cyber Threat Intelligence Platform
"""
from dotenv import load_dotenv
load_dotenv(override=True)  # Load .env before any other imports read os.environ

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.routes.analysis import router as analysis_router
from api.routes.export import router as export_router
from api.routes.intelligence import router as intelligence_router
from api.routes.auth import router as auth_router
from api.routes.users import router as users_router
from api.routes.settings import router as settings_router
from api.routes.admin import router as admin_router
from api.routes.groups import router as groups_router
from database.config import engine, Base
import contextlib

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(
    title="autoMITRE API",
    description="AI-Driven Cyber Threat Intelligence Platform with MITRE ATT&CK, D3FEND, NIST SP 800-53, and OWASP mapping",
    version="1.2.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(settings_router)
app.include_router(analysis_router)
app.include_router(export_router)
app.include_router(intelligence_router)
app.include_router(admin_router)
app.include_router(groups_router)


@app.get("/")
async def root():
    return {
        "name": "autoMITRE",
        "version": "1.2.0",
        "description": "AI-Driven Cyber Threat Intelligence Platform",
        "docs": "/docs",
        "status": "operational"
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "autoMITRE API"}


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": str(exc), "detail": "Internal server error"}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
