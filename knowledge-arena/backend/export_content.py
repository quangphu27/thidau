"""Xuất đề thi + câu hỏi + ảnh ra seed_data/ để commit lên Git."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.content_pack import export_content

if __name__ == "__main__":
    export_content()
    print()
    print("Tiếp theo, commit các file sau:")
    print("  backend/seed_data/")
    print("  backend/uploads/   (nếu có ảnh mới)")
    print()
    print("  git add backend/seed_data backend/uploads")
    print("  git commit -m \"Cập nhật đề thi và media\"")
