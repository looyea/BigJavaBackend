@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Big Java Backend - 生产模式 (Vite build + preview)

rem ============================================================
rem   Big Java Backend · 大Java后端 —— 生产模式启动脚本
rem   先用 Vite 构建出纯静态产物 dist\，再本地预览。
rem   dist\ 即最终可部署物：整目录交给 Nginx / 对象存储 / GitHub Pages / CDN 即可上线。
rem   构建过程完全走 Node/npm，脱离 Python。
rem ============================================================

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
echo [1/3] 内容 / 结构自检： npm run check ...
call npm.cmd run check

echo.
echo [2/3] 构建纯静态产物： npm run build （输出到 dist\）...
call npm.cmd run build
if errorlevel 1 (
  echo [错误] 构建失败，已终止，未启动预览服务器。
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   Big Java Backend - 大Java后端   生产预览 (PROD)
echo   访问  :  http://localhost:8080        （浏览器自动打开）
echo   部署  :  dist\ 即纯静态产物，整目录交付任意静态服务器即可上线
echo   停止  :  本窗口按 Ctrl + C
echo ============================================================
echo.
start "" cmd /c "timeout /t 3 >nul & start http://localhost:8080/"

echo [3/3] 启动本地静态预览服务器 (vite preview) ...
call npm.cmd run preview

echo.
echo [生产预览已退出]
pause
