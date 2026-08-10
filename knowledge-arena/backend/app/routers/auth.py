from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Admin
from app.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
)
from app.utils import create_access_token, hash_password, verify_password
from app.utils.deps import get_current_admin

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    admin = db.query(Admin).filter(Admin.username == body.username).first()
    if not admin or not verify_password(body.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="INVALID_CREDENTIALS")
    token = create_access_token({"sub": admin.username})
    return LoginResponse(access_token=token, username=admin.username)


@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    if not verify_password(body.current_password, admin.password_hash):
        raise HTTPException(status_code=400, detail="INVALID_CREDENTIALS")
    admin.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True, "message": "Đổi mật khẩu thành công"}


@router.get("/me")
def me(admin: Admin = Depends(get_current_admin)):
    return {"username": admin.username, "id": admin.id}
