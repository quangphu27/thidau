"""Question bank CRUD, search, and copy into exams."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.content_pack import sync_content_pack
from app.database import get_db
from app.models import (
    Admin,
    AnswerOption,
    BankAnswerOption,
    BankQuestion,
    Exam,
    Question,
    Room,
    RoomStatus,
)
from app.schemas import (
    AddBankToExamRequest,
    BankQuestionCreate,
    BankQuestionListOut,
    BankQuestionOut,
    BankQuestionUpdate,
    QuestionOut,
)
from app.utils.deps import get_current_admin

router = APIRouter(prefix="/api/bank", tags=["bank"])


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


def _validate_options(question_type: str, options: list) -> None:
    if question_type == "MULTIPLE_CHOICE":
        if len(options) < 2:
            raise HTTPException(status_code=400, detail="INVALID_ANSWER")
        if not any(o.is_correct for o in options):
            raise HTTPException(status_code=400, detail="INVALID_ANSWER")
    elif question_type == "ESSAY":
        accepted = [o for o in options if (o.content or "").strip()]
        if not accepted:
            raise HTTPException(status_code=400, detail="INVALID_ANSWER")


def _build_options(db: Session, question_id: int, question_type: str, options: list) -> None:
    for oi, opt in enumerate(options):
        if question_type == "ESSAY" and not (opt.content or "").strip():
            continue
        db.add(
            BankAnswerOption(
                question_id=question_id,
                content=opt.content or "",
                is_correct=True if question_type == "ESSAY" else bool(opt.is_correct),
                media_type=opt.media_type or "NONE",
                media_url=opt.media_url,
                order_index=getattr(opt, "order_index", oi) or oi,
            )
        )


@router.get("/questions", response_model=BankQuestionListOut)
def list_bank_questions(
    q: Optional[str] = Query(None, description="Tìm theo nội dung hoặc tags"),
    question_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    query = db.query(BankQuestion)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(BankQuestion.content.ilike(term), BankQuestion.tags.ilike(term))
        )
    if question_type:
        query = query.filter(BankQuestion.question_type == question_type)

    total = query.count()
    items = (
        query.options(joinedload(BankQuestion.options))
        .order_by(BankQuestion.updated_at.desc(), BankQuestion.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return BankQuestionListOut(
        items=[BankQuestionOut.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/questions/{question_id}", response_model=BankQuestionOut)
def get_bank_question(
    question_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    item = (
        db.query(BankQuestion)
        .options(joinedload(BankQuestion.options))
        .filter(BankQuestion.id == question_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="QUESTION_NOT_FOUND")
    return BankQuestionOut.model_validate(item)


@router.post("/questions", response_model=BankQuestionOut)
def create_bank_question(
    body: BankQuestionCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    _validate_options(body.question_type, body.options)
    if body.question_type == "ESSAY":
        for o in body.options:
            o.is_correct = True

    item = BankQuestion(
        content=body.content.strip(),
        question_type=body.question_type,
        media_type=body.media_type,
        media_url=body.media_url,
        media_position=body.media_position,
        tags=(body.tags or "").strip(),
    )
    db.add(item)
    db.flush()
    _build_options(db, item.id, body.question_type, body.options)
    db.commit()
    sync_content_pack(db)
    item = (
        db.query(BankQuestion)
        .options(joinedload(BankQuestion.options))
        .filter(BankQuestion.id == item.id)
        .first()
    )
    return BankQuestionOut.model_validate(item)


@router.put("/questions/{question_id}", response_model=BankQuestionOut)
def update_bank_question(
    question_id: int,
    body: BankQuestionUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    item = (
        db.query(BankQuestion)
        .options(joinedload(BankQuestion.options))
        .filter(BankQuestion.id == question_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="QUESTION_NOT_FOUND")

    if body.content is not None:
        item.content = body.content.strip()
    if body.question_type is not None:
        item.question_type = body.question_type
    if body.media_type is not None:
        item.media_type = body.media_type
    if body.media_url is not None:
        item.media_url = body.media_url
    if body.media_position is not None:
        item.media_position = body.media_position
    if body.tags is not None:
        item.tags = body.tags.strip()

    if body.options is not None:
        qtype = body.question_type or item.question_type
        _validate_options(qtype, body.options)
        if qtype == "ESSAY":
            for o in body.options:
                o.is_correct = True
        for old in list(item.options):
            db.delete(old)
        db.flush()
        _build_options(db, item.id, qtype, body.options)

    db.commit()
    sync_content_pack(db)
    item = (
        db.query(BankQuestion)
        .options(joinedload(BankQuestion.options))
        .filter(BankQuestion.id == question_id)
        .first()
    )
    return BankQuestionOut.model_validate(item)


@router.delete("/questions/{question_id}")
def delete_bank_question(
    question_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    item = db.query(BankQuestion).filter(BankQuestion.id == question_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="QUESTION_NOT_FOUND")
    db.delete(item)
    db.commit()
    sync_content_pack(db)
    return {"ok": True}


@router.post("/questions/add-to-exam/{exam_id}", response_model=List[QuestionOut])
def add_bank_questions_to_exam(
    exam_id: int,
    body: AddBankToExamRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="EXAM_NOT_FOUND")
    if _exam_locked(db, exam_id):
        raise HTTPException(status_code=400, detail="EXAM_IN_USE")

    bank_items = (
        db.query(BankQuestion)
        .options(joinedload(BankQuestion.options))
        .filter(BankQuestion.id.in_(body.bank_question_ids))
        .all()
    )
    by_id = {b.id: b for b in bank_items}
    missing = [i for i in body.bank_question_ids if i not in by_id]
    if missing:
        raise HTTPException(status_code=404, detail="QUESTION_NOT_FOUND")

    max_order = (
        db.query(Question)
        .filter(Question.exam_id == exam_id)
        .count()
    )
    created: list[Question] = []
    # Preserve selection order from request
    for bid in body.bank_question_ids:
        bq = by_id[bid]
        q = Question(
            exam_id=exam_id,
            content=bq.content,
            question_type=bq.question_type,
            order_index=max_order,
            media_type=bq.media_type or "NONE",
            media_url=bq.media_url,
            media_position=bq.media_position or "BEFORE",
        )
        db.add(q)
        db.flush()
        for oi, opt in enumerate(sorted(bq.options, key=lambda o: o.order_index)):
            db.add(
                AnswerOption(
                    question_id=q.id,
                    content=opt.content or "",
                    is_correct=bool(opt.is_correct),
                    media_type=opt.media_type or "NONE",
                    media_url=opt.media_url,
                    order_index=oi,
                )
            )
        created.append(q)
        max_order += 1

    db.commit()
    sync_content_pack(db)

    result = (
        db.query(Question)
        .options(joinedload(Question.options))
        .filter(Question.id.in_([q.id for q in created]))
        .order_by(Question.order_index)
        .all()
    )
    return [QuestionOut.model_validate(q) for q in result]
