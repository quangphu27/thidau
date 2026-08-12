from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase

BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_URL = f"sqlite:///{BASE_DIR / 'database.db'}"
UPLOAD_DIR = BASE_DIR / "uploads"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app import models  # noqa: F401
    from sqlalchemy import text, inspect

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    (UPLOAD_DIR / "images").mkdir(exist_ok=True)
    (UPLOAD_DIR / "audio").mkdir(exist_ok=True)
    (UPLOAD_DIR / "videos").mkdir(exist_ok=True)
    Base.metadata.create_all(bind=engine)

    # Lightweight SQLite column adds
    try:
        insp = inspect(engine)
        if "questions" in insp.get_table_names():
            cols = {c["name"] for c in insp.get_columns("questions")}
            with engine.begin() as conn:
                if "points" not in cols:
                    conn.execute(
                        text("ALTER TABLE questions ADD COLUMN points INTEGER DEFAULT 10")
                    )
                if "input_mode" not in cols:
                    conn.execute(
                        text(
                            "ALTER TABLE questions ADD COLUMN input_mode VARCHAR(20) DEFAULT 'TEXT'"
                        )
                    )
                if "blocks_json" not in cols:
                    conn.execute(text("ALTER TABLE questions ADD COLUMN blocks_json TEXT"))
        if "bank_questions" in insp.get_table_names():
            bcols = {c["name"] for c in insp.get_columns("bank_questions")}
            with engine.begin() as conn:
                if "blocks_json" not in bcols:
                    conn.execute(
                        text("ALTER TABLE bank_questions ADD COLUMN blocks_json TEXT")
                    )
                if "points" not in bcols:
                    conn.execute(
                        text(
                            "ALTER TABLE bank_questions ADD COLUMN points INTEGER DEFAULT 10"
                        )
                    )
                if "input_mode" not in bcols:
                    conn.execute(
                        text(
                            "ALTER TABLE bank_questions ADD COLUMN input_mode VARCHAR(20) DEFAULT 'TEXT'"
                        )
                    )
    except Exception:
        pass

    # Migrate: drop old "one submission per question" unique if present
    try:
        insp = inspect(engine)
        if "submissions" in insp.get_table_names():
            uniques = {u["name"] for u in insp.get_unique_constraints("submissions")}
            indexes = {i["name"] for i in insp.get_indexes("submissions")}
            if "uq_first_valid_per_question" in uniques or "uq_first_valid_per_question" in indexes:
                with engine.begin() as conn:
                    conn.execute(text("DROP INDEX IF EXISTS uq_first_valid_per_question"))
                    # SQLite may store UNIQUE as table constraint — rebuild table
                    conn.execute(text("ALTER TABLE submissions RENAME TO submissions_old"))
                    conn.execute(
                        text(
                            """
                            CREATE TABLE submissions (
                                id INTEGER NOT NULL PRIMARY KEY,
                                room_id INTEGER NOT NULL,
                                question_id INTEGER NOT NULL,
                                player_id VARCHAR(50) NOT NULL,
                                answer_id INTEGER,
                                answer_text TEXT,
                                is_correct BOOLEAN,
                                is_first BOOLEAN,
                                submitted_at DATETIME,
                                points INTEGER,
                                response_time_ms FLOAT,
                                essay_graded BOOLEAN,
                                FOREIGN KEY(room_id) REFERENCES rooms (id) ON DELETE CASCADE,
                                FOREIGN KEY(question_id) REFERENCES questions (id),
                                FOREIGN KEY(player_id) REFERENCES players (player_id),
                                FOREIGN KEY(answer_id) REFERENCES answer_options (id),
                                CONSTRAINT uq_player_question UNIQUE (room_id, question_id, player_id)
                            )
                            """
                        )
                    )
                    conn.execute(
                        text(
                            """
                            INSERT INTO submissions
                            SELECT id, room_id, question_id, player_id, answer_id, answer_text,
                                   is_correct, is_first, submitted_at, points, response_time_ms, essay_graded
                            FROM submissions_old
                            """
                        )
                    )
                    conn.execute(text("DROP TABLE submissions_old"))
                    conn.execute(
                        text(
                            "CREATE INDEX IF NOT EXISTS ix_submission_room_question "
                            "ON submissions (room_id, question_id)"
                        )
                    )
    except Exception:
        pass
