"""Import đề thi từ seed_data/ (dùng sau khi clone hoặc khôi phục)."""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.content_pack import import_content, sync_exams_from_seed
from app.database import SessionLocal, init_db

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import exams from seed_data")
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Xóa toàn bộ đề thi hiện có rồi import lại từ seed_data",
    )
    parser.add_argument(
        "--sync",
        action="store_true",
        help="Cập nhật đề thi trùng tên từ seed_data (giữ id đề, không cần xóa DB)",
    )
    args = parser.parse_args()
    if args.sync:
        init_db()
        db = SessionLocal()
        try:
            ok = sync_exams_from_seed(db, force=True)
        finally:
            db.close()
        if not ok:
            print("• Khong sync duoc (thieu seed_data/content.json).")
        else:
            print("• Da dong bo de thi tu seed_data.")
    else:
        ok = import_content(only_if_empty=not args.replace, replace_existing=args.replace)
        if not ok:
            print("• Không import (đã có dữ liệu hoặc thiếu seed_data/content.json).")
            print("  Dùng --sync để cập nhật đề trùng tên, hoặc --replace để ghi đè toàn bộ.")
