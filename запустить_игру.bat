@echo off
start npm run dev
timeout /t 5
start http://127.0.0.1:5173/