"""Import đề thi từ seed_data/ (dùng sau khi clone hoặc khôi phục)."""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.content_pack import import_content

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import exams from seed_data")
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Xóa toàn bộ đề thi hiện có rồi import lại từ seed_data",
    )
    args = parser.parse_args()
    ok = import_content(only_if_empty=not args.replace, replace_existing=args.replace)
    if not ok:
        print("• Không import (đã có dữ liệu hoặc thiếu seed_data/content.json).")
        print("  Dùng --replace để ghi đè.")
