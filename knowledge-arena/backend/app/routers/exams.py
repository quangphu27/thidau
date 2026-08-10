from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.content_pack import sync_content_pack
from app.database import get_db
from app.models import Admin, Exam, Question, Room, RoomStatus
from app.schemas import ExamCreate, ExamDetail, ExamOut, ExamUpdate, QuestionOut
from app.utils.deps import get_current_admin

router = APIRouter(prefix="/api/exams", tags=["exams"])


def _exam_out(exam: Exam) -> ExamOut:
    return ExamOut(
        id=exam.id,
        title=exam.title,
        description=exam.description or "",
        time_per_question=exam.time_per_question,
        created_at=exam.created_at,
        updated_at=exam.updated_at,
        question_count=len(exam.questions) if exam.questions is not None else 0,
    )


@router.get("", response_model=List[ExamOut])
def list_exams(
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    exams = (
        db.query(Exam)
        .options(joinedload(Exam.questions))
        .order_by(Exam.created_at.desc())
        .all()
    )
    return [_exam_out(e) for e in exams]


@router.post("", response_model=ExamOut)
def create_exam(
    body: ExamCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    exam = Exam(
        title=body.title.strip(),
        description=body.description or "",
        time_per_question=body.time_per_question,
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)
    exam.questions = []
    sync_content_pack(db)
    return _exam_out(exam)


@router.get("/{exam_id}", response_model=ExamDetail)
def get_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    exam = (
        db.query(Exam)
        .options(joinedload(Exam.questions).joinedload(Question.options))
        .filter(Exam.id == exam_id)
        .first()
    )
    if not exam:
        raise HTTPException(status_code=404, detail="EXAM_NOT_FOUND")
    questions = sorted(exam.questions, key=lambda q: (q.order_index, q.id))
    return ExamDetail(
        id=exam.id,
        title=exam.title,
        description=exam.description or "",
        time_per_question=exam.time_per_question,
        created_at=exam.created_at,
        updated_at=exam.updated_at,
        question_count=len(questions),
        questions=[QuestionOut.model_validate(q) for q in questions],
    )


def _exam_in_use(db: Session, exam_id: int) -> bool:
    return (
        db.query(Room)
        .filter(
            Room.exam_id == exam_id,
            Room.status.in_(
                [RoomStatus.WAITING.value, RoomStatus.RUNNING.value, RoomStatus.PAUSED.value]
            ),
        )
        .first()
        is not None
    )


@router.put("/{exam_id}", response_model=ExamOut)
def update_exam(
    exam_id: int,
    body: ExamUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    exam = (
        db.query(Exam)
        .options(joinedload(Exam.questions))
        .filter(Exam.id == exam_id)
        .first()
    )
    if not exam:
        raise HTTPException(status_code=404, detail="EXAM_NOT_FOUND")
    if _exam_in_use(db, exam_id):
        raise HTTPException(status_code=400, detail="EXAM_IN_USE")
    if body.title is not None:
        exam.title = body.title.strip()
    if body.description is not None:
        exam.description = body.description
    if body.time_per_question is not None:
        exam.time_per_question = body.time_per_question
    db.commit()
    db.refresh(exam)
    sync_content_pack(db)
    return _exam_out(exam)


@router.delete("/{exam_id}")
def delete_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="EXAM_NOT_FOUND")
    if _exam_in_use(db, exam_id):
        raise HTTPException(status_code=400, detail="EXAM_IN_USE")
    db.delete(exam)
    db.commit()
    sync_content_pack(db)
    return {"ok": True}
