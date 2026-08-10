from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.content_pack import sync_content_pack
from app.database import get_db
from app.models import Admin, AnswerOption, Exam, Question, Room, RoomStatus
from app.schemas import QuestionCreate, QuestionOut, QuestionUpdate
from app.utils.deps import get_current_admin

router = APIRouter(prefix="/api/questions", tags=["questions"])


def _exam_locked(db: Session, exam_id: int) -> bool:
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


@router.get("", response_model=List[QuestionOut])
def list_questions(
    exam_id: int | None = None,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    q = db.query(Question).options(joinedload(Question.options))
    if exam_id is not None:
        q = q.filter(Question.exam_id == exam_id)
    questions = q.order_by(Question.exam_id, Question.order_index, Question.id).all()
    return [QuestionOut.model_validate(item) for item in questions]


@router.post("", response_model=QuestionOut)
def create_question(
    body: QuestionCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    exam = db.query(Exam).filter(Exam.id == body.exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="EXAM_NOT_FOUND")
    if _exam_locked(db, body.exam_id):
        raise HTTPException(status_code=400, detail="EXAM_IN_USE")

    if body.question_type == "MULTIPLE_CHOICE":
        if len(body.options) < 2:
            raise HTTPException(status_code=400, detail="INVALID_ANSWER")
        if not any(o.is_correct for o in body.options):
            raise HTTPException(status_code=400, detail="INVALID_ANSWER")
    elif body.question_type == "ESSAY":
        accepted = [o for o in body.options if (o.content or "").strip()]
        if not accepted:
            raise HTTPException(status_code=400, detail="INVALID_ANSWER")
        # Normalize: all essay options are accepted answers
        for o in body.options:
            o.is_correct = True

    question = Question(
        exam_id=body.exam_id,
        content=body.content.strip(),
        question_type=body.question_type,
        order_index=body.order_index,
        media_type=body.media_type,
        media_url=body.media_url,
        media_position=body.media_position,
    )
    db.add(question)
    db.flush()
    for opt in body.options:
        if body.question_type == "ESSAY" and not (opt.content or "").strip():
            continue
        db.add(
            AnswerOption(
                question_id=question.id,
                content=opt.content,
                is_correct=True if body.question_type == "ESSAY" else opt.is_correct,
                media_type=opt.media_type,
                media_url=opt.media_url,
                order_index=opt.order_index,
            )
        )
    db.commit()
    sync_content_pack(db)
    question = (
        db.query(Question)
        .options(joinedload(Question.options))
        .filter(Question.id == question.id)
        .first()
    )
    return QuestionOut.model_validate(question)


@router.put("/{question_id}", response_model=QuestionOut)
def update_question(
    question_id: int,
    body: QuestionUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    question = (
        db.query(Question)
        .options(joinedload(Question.options))
        .filter(Question.id == question_id)
        .first()
    )
    if not question:
        raise HTTPException(status_code=404, detail="QUESTION_NOT_FOUND")
    if _exam_locked(db, question.exam_id):
        raise HTTPException(status_code=400, detail="EXAM_IN_USE")

    if body.content is not None:
        question.content = body.content.strip()
    if body.question_type is not None:
        question.question_type = body.question_type
    if body.order_index is not None:
        question.order_index = body.order_index
    if body.media_type is not None:
        question.media_type = body.media_type
    if body.media_url is not None:
        question.media_url = body.media_url
    if body.media_position is not None:
        question.media_position = body.media_position

    if body.options is not None:
        qtype = body.question_type or question.question_type
        if qtype == "ESSAY":
            accepted = [o for o in body.options if (o.content or "").strip()]
            if not accepted:
                raise HTTPException(status_code=400, detail="INVALID_ANSWER")
            for o in body.options:
                o.is_correct = True
        elif qtype == "MULTIPLE_CHOICE":
            if len(body.options) < 2 or not any(o.is_correct for o in body.options):
                raise HTTPException(status_code=400, detail="INVALID_ANSWER")
        for old in list(question.options):
            db.delete(old)
        db.flush()
        for opt in body.options:
            if qtype == "ESSAY" and not (opt.content or "").strip():
                continue
            db.add(
                AnswerOption(
                    question_id=question.id,
                    content=opt.content,
                    is_correct=True if qtype == "ESSAY" else opt.is_correct,
                    media_type=opt.media_type,
                    media_url=opt.media_url,
                    order_index=opt.order_index,
                )
            )
    db.commit()
    sync_content_pack(db)
    question = (
        db.query(Question)
        .options(joinedload(Question.options))
        .filter(Question.id == question_id)
        .first()
    )
    return QuestionOut.model_validate(question)


@router.delete("/{question_id}")
def delete_question(
    question_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="QUESTION_NOT_FOUND")
    if _exam_locked(db, question.exam_id):
        raise HTTPException(status_code=400, detail="EXAM_IN_USE")
    db.delete(question)
    db.commit()
    sync_content_pack(db)
    return {"ok": True}


@router.post("/reorder")
def reorder_questions(
    exam_id: int,
    order: List[int],
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    if _exam_locked(db, exam_id):
        raise HTTPException(status_code=400, detail="EXAM_IN_USE")
    for idx, qid in enumerate(order):
        q = (
            db.query(Question)
            .filter(Question.id == qid, Question.exam_id == exam_id)
            .first()
        )
        if q:
            q.order_index = idx
    db.commit()
    sync_content_pack(db)
    return {"ok": True}
