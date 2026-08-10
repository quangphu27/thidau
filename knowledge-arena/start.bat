@echo off
chcp 65001 >nul
title Đấu Trường Kiến Thức
cd /d "%~dp0"

echo ====================================
echo      ĐẤU TRƯỜNG KIẾN THỨC
echo ====================================
echo.

REM Detect LAN IPv4
set "LAN_IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  if not defined LAN_IP (
    set "LAN_IP=%%a"
  )
)
set "LAN_IP=%LAN_IP: =%"
if "%LAN_IP%"=="" set "LAN_IP=127.0.0.1"

echo IP LAN phát hiện: %LAN_IP%
echo.

REM Write frontend env for LAN
(
  echo VITE_API_URL=http://%LAN_IP%:8000
  echo VITE_WS_URL=ws://%LAN_IP%:8000
) > frontend\.env.local

echo Đã ghi frontend\.env.local
echo.

REM Backend venv
if not exist "backend\venv\Scripts\python.exe" (
  echo Đang tạo virtualenv...
  python -m venv backend\venv
  call backend\venv\Scripts\activate.bat
  pip install -r backend\requirements.txt
  call backend\venv\Scripts\python.exe backend\seed.py
) else (
  call backend\venv\Scripts\activate.bat
)

REM Seed / import đề thi từ seed_data nếu DB chưa có
if not exist "backend\database.db" (
  python backend\seed.py
) else (
  python backend\import_content.py
)

echo Khởi động Backend (port 8000)...
start "Arena-Backend" cmd /k "cd /d "%~dp0backend" && call venv\Scripts\activate.bat && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 3 /nobreak >nul

echo Khởi động Frontend (port 5173)...
start "Arena-Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev -- --host 0.0.0.0 --port 5173"

timeout /t 4 /nobreak >nul

echo.
echo ====================================
echo      ĐẤU TRƯỜNG KIẾN THỨC
echo ====================================
echo.
echo Server đang chạy!
echo.
echo Admin:
echo http://%LAN_IP%:5173/admin
echo.
echo Học sinh:
echo http://%LAN_IP%:5173
echo.
echo Backend:
echo http://%LAN_IP%:8000
echo.
echo Tài khoản mặc định: admin / admin123
echo.
echo Mở Firewall nếu cần:
echo   netsh advfirewall firewall add rule name="Arena Frontend" dir=in action=allow protocol=TCP localport=5173
echo   netsh advfirewall firewall add rule name="Arena Backend" dir=in action=allow protocol=TCP localport=8000
echo ====================================
echo.
start http://%LAN_IP%:5173/admin
pause
