@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Big Java Backend - 开发模式 (Vite dev)

rem ============================================================
rem   Big Java Backend · 大Java后端 —— 开发模式启动脚本
rem   基于 Vite（大前端标准工具链），完全脱离 Python。
rem   本应用是原生 ES Module 单页站，Vite 直接托管源码目录并提供热更新。
rem ============================================================

rem 依赖自检：首次或缺 node_modules\vite 时自动安装
if not exist "node_modules\vite" (
  echo [提示] 未检测到依赖，正在执行 npm install ...
  call npm.cmd install
  if errorlevel 1 (
    echo [错误] npm install 失败，请确认已安装 Node 且网络可用。
    pause
    exit /b 1
  )
)

echo.
echo ============================================================
echo   Big Java Backend - 大Java后端   开发模式 (Vite DEV)
echo   访问  :  http://localhost:5180        （浏览器自动打开）
echo   热更新:  改任意源文件后，界面即时刷新
echo   停止  :  本窗口按 Ctrl + C
echo ============================================================
echo.
start "" cmd /c "timeout /t 3 >nul & start http://localhost:5180/"

call npm.cmd run dev

echo.
echo [开发模式已退出]
pause
