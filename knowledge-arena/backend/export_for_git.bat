@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Xuat de thi + anh vao seed_data de commit len Git...
echo.
call venv\Scripts\activate.bat
python export_content.py
echo.
echo Goi y: git add seed_data uploads ^&^& git commit -m "Cap nhat de thi va media"
pause
