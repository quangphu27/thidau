import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.database import UPLOAD_DIR
from app.models import Admin
from app.utils.deps import get_current_admin

router = APIRouter(prefix="/api/upload", tags=["upload"])

ALLOWED = {
    "image": {".jpg", ".jpeg", ".png", ".gif", ".webp"},
    "audio": {".mp3", ".wav", ".ogg", ".m4a", ".aac"},
    "video": {".mp4", ".webm", ".mov"},
}

FOLDER_MAP = {
    "image": "images",
    "audio": "audio",
    "video": "videos",
}

MEDIA_TYPE_MAP = {
    "image": "IMAGE",
    "audio": "AUDIO",
    "video": "VIDEO",
}


def _detect_kind(ext: str) -> str | None:
    for kind, exts in ALLOWED.items():
        if ext in exts:
            return kind
    return None


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    admin: Admin = Depends(get_current_admin),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="INVALID_ANSWER")
    ext = Path(file.filename).suffix.lower()
    kind = _detect_kind(ext)
    if not kind:
        raise HTTPException(
            status_code=400,
            detail="MEDIA_TYPE_UNSUPPORTED",
        )
    folder = FOLDER_MAP[kind]
    dest_dir = UPLOAD_DIR / folder
    dest_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = dest_dir / filename
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="NOT_ALLOWED")
    dest.write_bytes(content)
    url = f"/media/{folder}/{filename}"
    return {
        "url": url,
        "media_type": MEDIA_TYPE_MAP[kind],
        "filename": filename,
    }
