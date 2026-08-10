from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import UPLOAD_DIR, init_db
from app.routers import auth, bank, dashboard, exams, questions, rooms, upload
from app.routers.websocket_routes import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Ensure default admin exists
    from app.database import SessionLocal
    from app.content_pack import CONTENT_FILE, ensure_content_on_startup
    from app.models import Admin, Exam, Setting
    from app.utils import hash_password

    db = SessionLocal()
    try:
        if not db.query(Admin).filter(Admin.username == "admin").first():
            db.add(
                Admin(username="admin", password_hash=hash_password("admin123"))
            )
            db.commit()
        host = db.query(Setting).filter(Setting.key == "admin_display_name").first()
        if not host:
            db.add(Setting(key="admin_display_name", value="Thầy Phú Anex"))
            db.commit()
        elif not (host.value or "").strip() or host.value.strip() == "Admin":
            host.value = "Thầy Phú Anex"
            db.commit()
    finally:
        db.close()

    # Restore exams + media from seed_data after clone (empty DB)
    ensure_content_on_startup()

    # Fallback sample data if pack missing and still empty
    db = SessionLocal()
    try:
        if db.query(Exam).count() == 0 and not CONTENT_FILE.is_file():
            from seed import seed

            seed()
    finally:
        db.close()
    yield


app = FastAPI(
    title="Đấu Trường Kiến Thức",
    description="Hệ thống thi đấu trắc nghiệm trực tiếp",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(UPLOAD_DIR)), name="media")

app.include_router(auth.router)
app.include_router(exams.router)
app.include_router(questions.router)
app.include_router(bank.router)
app.include_router(rooms.router)
app.include_router(upload.router)
app.include_router(dashboard.router)
app.include_router(ws_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "Đấu Trường Kiến Thức"}


@app.get("/api/lan-ip")
def lan_ip():
    import socket

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        ip = "127.0.0.1"
    return {
        "ip": ip,
        "frontend_url": f"http://{ip}:5173",
        "backend_url": f"http://{ip}:8000",
        "admin_url": f"http://{ip}:5173/admin",
    }
