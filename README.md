# Đấu Trường Kiến Thức

Ứng dụng thi đấu kiến thức realtime (LAN). Mã nguồn nằm trong thư mục `knowledge-arena/`.

## Clone máy mới (Windows)

Cần **Python 3.11+** và **Node.js 18+**.

```bat
git clone https://github.com/quangphu27/thidau.git
cd thidau\knowledge-arena
start.bat
```

`start.bat` sẽ:

- tạo virtualenv + `pip install`
- import đề thi / câu hỏi / ảnh từ `backend/seed_data/`
- `npm install` nếu chưa có
- chạy backend `:8000` và frontend `:5173`

Admin: http://localhost:5173/admin — tài khoản `admin` / `admin123`  
Học sinh: http://localhost:5173

Chi tiết: [knowledge-arena/README.md](knowledge-arena/README.md)

SQLite `database.db` không đưa lên git. Máy mới tự tạo DB rồi nạp `seed_data/`.

Nếu máy đã có DB cũ rồi `git pull`, chạy:

```bat
cd knowledge-arena\backend
venv\Scripts\activate
python import_content.py --sync
```

hoặc xóa `backend\database.db` rồi chạy lại `start.bat`.
