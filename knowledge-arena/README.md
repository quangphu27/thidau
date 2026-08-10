# Đấu Trường Kiến Thức

Ứng dụng web thi đấu trắc nghiệm trực tiếp giữa học sinh trong cùng một phòng — realtime qua WebSocket, tối ưu cho mạng LAN (phòng máy / lớp học).

## Tính năng chính

- Admin tạo bài thi, câu hỏi (trắc nghiệm / tự luận), đính kèm ảnh / audio / video
- Tạo phòng thi với mã + link tham gia
- Học sinh vào phòng bằng tên (không cần tài khoản)
- Đồng bộ realtime: câu hỏi, timer, điểm, thông báo người trả lời đúng
- **Chỉ người submit đầu tiên** được ghi nhận (chống race condition)
- Mỗi học sinh chỉ trả lời **1 lần / câu**
- Bảng xếp hạng + màn hình vinh danh quán quân
- Presentation mode cho máy chiếu

## Yêu cầu

- Python 3.11+
- Node.js 18+
- Windows / macOS / Linux

## Cài backend

```bash
cd backend
python -m venv venv
```

Windows:

```bash
venv\Scripts\activate
pip install -r requirements.txt
python seed.py
```

## Chạy backend

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

> Bắt buộc `--host 0.0.0.0` để thiết bị khác trong LAN truy cập được.

## Cài frontend

```bash
cd frontend
npm install
```

## Cấu hình IP LAN

Tạo file `frontend/.env` hoặc `frontend/.env.local`:

```env
VITE_API_URL=http://192.168.1.100:8000
VITE_WS_URL=ws://192.168.1.100:8000
```

Thay `192.168.1.100` bằng IP máy chủ của bạn.

Nếu để trống (mặc định khi dev với Vite proxy), frontend gọi relative `/api` và `/ws` qua proxy.

## Chạy frontend

```bash
npm run dev -- --host 0.0.0.0
```

## Tìm IP LAN (Windows)

```bash
ipconfig
```

Tìm dòng **IPv4 Address**, ví dụ:

```text
IPv4 Address. . . . . . . . . . . : 192.168.1.100
```

Học sinh truy cập:

```text
http://192.168.1.100:5173
```

Admin:

```text
http://192.168.1.100:5173/admin
```

## Windows Firewall

Mở port 8000 và 5173 (chạy PowerShell/CMD **Admin**):

```bash
netsh advfirewall firewall add rule name="Arena Backend" dir=in action=allow protocol=TCP localport=8000
netsh advfirewall firewall add rule name="Arena Frontend" dir=in action=allow protocol=TCP localport=5173
```

## Khởi động nhanh

Double-click:

```text
start.bat
```

Script sẽ:

1. Phát hiện IP LAN
2. Ghi `frontend/.env.local`
3. Khởi động backend + frontend
4. In URL Admin / Học sinh

## Tài khoản Admin mặc định

```text
username: admin
password: admin123
```

Đổi mật khẩu trong **Cài đặt**. Mật khẩu được hash (bcrypt), không lưu plaintext.

## Luồng sử dụng

1. Admin đăng nhập → tạo / chọn bài thi → thêm câu hỏi
2. **Phòng thi** → chọn bài → **TẠO PHÒNG** → sao chép link
3. Học sinh mở link `/join/ABC123` → nhập tên → **THAM GIA**
4. Admin **BẮT ĐẦU** → học sinh trả lời (ai nhanh nhất được ghi nhận)
5. **CÂU TIẾP THEO** / **KẾT THÚC** → bảng xếp hạng + vinh danh

## WebSocket

```text
ws://IP:8000/ws/room/ABC123?role=student&player_id=...
```

Roles: `student` | `admin` | `presentation`

### Client → Server

- `join_room`
- `submit_answer`
- `ping`

### Server → Client

- `room_updated`, `player_joined`, `player_left`
- `game_started`, `question_started`, `question_finished`
- `answer_correct`, `answer_wrong`, `answer_received`
- `score_updated`, `game_finished`, `error`

## Race condition (người trả lời đầu tiên)

Server bảo vệ nhiều lớp:

1. `asyncio.Lock` theo từng phòng
2. Kiểm tra `question_answered` trước khi ghi
3. Unique constraint SQLite `(room_id, question_id)` — chỉ 1 submission hợp lệ / câu
4. Unique `(room_id, question_id, player_id)` — không submit 2 lần

Frontend **không** quyết định ai thắng.

## API chính

| Method | Path | Mô tả |
|--------|------|--------|
| POST | `/api/auth/login` | Đăng nhập admin |
| GET/POST | `/api/exams` | Danh sách / tạo bài thi |
| POST | `/api/questions` | Tạo câu hỏi |
| POST | `/api/upload` | Upload media |
| POST | `/api/rooms` | Tạo phòng |
| POST | `/api/rooms/{code}/join` | Học sinh tham gia |
| POST | `/api/rooms/{code}/start\|next\|pause\|finish` | Điều khiển |
| GET | `/api/rooms/{code}/results` | Kết quả |

## Test

```bash
cd backend
venv\Scripts\activate
pytest tests/ -v
```

## Cấu trúc thư mục

```text
knowledge-arena/
├── backend/
│   ├── seed_data/        # Đề thi + ảnh để clone (commit lên git)
│   ├── uploads/          # Media runtime (cũng nên commit)
│   ├── export_content.py # Xuất dữ liệu thủ công
│   └── ...
├── frontend/
├── README.md
└── start.bat
```

## Git: giữ đề thi, câu hỏi và ảnh khi clone

SQLite (`database.db`) **không** commit lên git (mỗi máy tạo DB riêng).  
Đề thi / câu hỏi / ảnh được lưu trong **`backend/seed_data/`** (và file media trong `backend/uploads/`).

### Trước khi push (máy có dữ liệu mới)

Khi bạn thêm/sửa đề hoặc câu hỏi trên Admin, hệ thống **tự ghi** vào `seed_data/`.  
Trước khi push chỉ cần add và commit:

```bash
cd backend
git add seed_data uploads
git commit -m "Cập nhật đề thi và media"
git push
```

Hoặc chạy tay (double-click `export_for_git.bat` / `python export_content.py`) để xuất lại toàn bộ.

### Sau khi clone (máy mới)

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
# Chạy server — tự import seed_data nếu DB trống
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Hoặc thủ công:

```bash
python import_content.py
```

Khi khởi động, backend luôn khôi phục file media từ `seed_data/media/` → `uploads/`.

## Lưu ý

- Không hard-code `localhost` trong production — dùng `VITE_API_URL` / `VITE_WS_URL`
- Điểm số chỉ tính ở server
- Timer hiển thị dựa trên `ends_at` từ server
- Media lưu tại `backend/uploads/`, serve qua `/media/...`
- **Nhớ chạy `python export_content.py` trước khi push** nếu vừa thêm/sửa đề hoặc upload ảnh
