from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Admin, Exam, Player, Question, Room, RoomStatus, Setting
from app.schemas import DashboardStats, SettingsOut, SettingUpdate
from app.utils.deps import get_current_admin

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard/stats", response_model=DashboardStats)
def dashboard_stats(
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    total_exams = db.query(Exam).count()
    total_questions = db.query(Question).count()
    active_rooms = (
        db.query(Room)
        .filter(
            Room.status.in_(
                [
                    RoomStatus.WAITING.value,
                    RoomStatus.RUNNING.value,
                    RoomStatus.PAUSED.value,
                ]
            )
        )
        .count()
    )
    active_room_ids = [
        r.id
        for r in db.query(Room)
        .filter(
            Room.status.in_(
                [
                    RoomStatus.WAITING.value,
                    RoomStatus.RUNNING.value,
                    RoomStatus.PAUSED.value,
                ]
            )
        )
        .all()
    ]
    active_players = 0
    if active_room_ids:
        active_players = (
            db.query(Player).filter(Player.room_id.in_(active_room_ids)).count()
        )
    return DashboardStats(
        total_exams=total_exams,
        total_questions=total_questions,
        active_rooms=active_rooms,
        active_players=active_players,
    )


def _get_setting(db: Session, key: str, default: str = "") -> str:
    row = db.query(Setting).filter(Setting.key == key).first()
    return row.value if row else default


def _set_setting(db: Session, key: str, value: str):
    row = db.query(Setting).filter(Setting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(Setting(key=key, value=value))
    db.commit()


@router.get("/settings", response_model=SettingsOut)
def get_settings(
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    return SettingsOut(
        sound_enabled=_get_setting(db, "sound_enabled", "true") == "true",
        admin_display_name=_get_setting(db, "admin_display_name", "Thầy Phú Anex"),
    )


@router.put("/settings", response_model=SettingsOut)
def update_settings(
    body: SettingUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    if body.sound_enabled is not None:
        _set_setting(db, "sound_enabled", "true" if body.sound_enabled else "false")
    if body.admin_display_name is not None:
        _set_setting(db, "admin_display_name", body.admin_display_name)
    return get_settings(db, admin)
